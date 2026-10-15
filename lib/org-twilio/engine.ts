import "server-only"

import crypto from "crypto"
import type { Twilio } from "twilio"

import { supabaseAdmin } from "@/lib/supabase"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { isOrgTelnyxPinnedEnv } from "@/lib/providers/sms/routing"
import { getTwilioClientForOrg } from "@/lib/twilio/org-client"
import { ensureOrgSubaccount, ensureOrgVoiceCredentials } from "@/lib/twilio/subaccounts"
import { getOrgTwilio, mergeProvisioningState, upsertOrgTwilio } from "@/lib/org-twilio/service"
import type { OrgTwilio, OrgTwilioPatch, OrgTwilioSetupStage, ProvisioningState } from "@/lib/org-twilio/types"
import { resolveComplianceUrls } from "@/lib/org-twilio/compliance-urls"
import {
  brandNamesFrom,
  loadRegistrationData,
  soleProprietorInputsFrom,
  standardInputsFrom,
  type RegistrationData,
} from "@/lib/org-twilio/inputs"
import {
  RESUBMISSIONS_EXHAUSTED_MESSAGE,
  issuesFromBrandErrors,
  issuesFromCampaignErrors,
  issuesFromEvaluation,
  issuesHash,
  type CustomerIssue,
} from "@/lib/org-twilio/issues"
import { searchLocalNumbers } from "@/lib/org-twilio/number-search"
import { notifyActionRequired, notifyLive, notifyPlatformAdminsAwaitingApproval } from "@/lib/org-twilio/notify"
import {
  ensureSoleProprietorDrafts,
  ensureStandardDrafts,
  isInOrPastReview,
  submitTrustHub,
  type DraftResult,
} from "@/lib/org-twilio/trusthub"
import {
  BRAND_TYPE_SOLE_PROPRIETOR,
  BRAND_TYPE_STANDARD,
  CampaignContentError,
  buildCampaignAttributes,
  buildMessageFlow,
  soleProprietorBrandName,
  type BrandType,
} from "@/lib/org-twilio/twilio-attributes"
import type { UsAppToPersonListInstanceCreateOptions } from "twilio/lib/rest/messaging/v1/service/usAppToPerson"

// The Twilio registration engine: one idempotent entry point that walks a
// non-owner org through Twilio's documented ISV A2P 10DLC order (Standard or
// Sole Proprietor). Safe to call any number of times — from submit, admin
// approval, Event Streams, the Trust Hub callback, or the cron. Every step is
// skipped when its SID/flag is already stored, and every result is persisted
// before the next step runs.
//
// Spend gate: everything that costs money (number, brand, campaign) waits for a
// platform admin's approval. Free resources (subaccount, Messaging Service,
// Trust Hub drafts and their submission for review, Event Streams) are built
// before it.

const LEASE_MS = 90_000
const MINUTE = 60_000

type AdvanceResult = { stage: OrgTwilioSetupStage; changed: boolean }

// ---- Throttle: ≤1 brand/campaign request per second per account ---------------

let lastRegistrationCallAt = 0
function minIntervalMs() {
  const override = Number(process.env.TWILIO_REGISTRATION_MIN_INTERVAL_MS)
  return Number.isFinite(override) && override >= 0 ? override : 1100
}
async function throttle() {
  const wait = lastRegistrationCallAt + minIntervalMs() - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRegistrationCallAt = Date.now()
}

// ---- Helpers -----------------------------------------------------------------

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "")
}

function inMinutes(minutes: number) {
  return new Date(Date.now() + minutes * MINUTE).toISOString()
}

function legacyA2pStatus(stage: OrgTwilioSetupStage): OrgTwilio["a2p_status"] {
  if (stage === "live") return "verified"
  if (stage === "action_required" || stage === "rejected") return "failed"
  return "provisioning"
}

export function eventsSignature(orgId: string): string {
  return crypto.createHmac("sha256", process.env.LISTHIT_SECRETS_KEY || "").update(orgId).digest("hex")
}

function errorStatus(err: unknown): number | null {
  const s = (err as { status?: unknown })?.status
  return typeof s === "number" ? s : null
}

function errorCode(err: unknown): string | null {
  const c = (err as { code?: unknown })?.code
  return c == null ? null : String(c)
}

function internalMessage(err: unknown): string {
  const e = err as { message?: string; code?: unknown }
  const code = e?.code != null ? ` (code ${e.code})` : ""
  return `${e?.message || "Unknown Twilio error"}${code}`
}

function areaCodeOf(phone: string | null | undefined): string | null {
  const e164 = formatPhoneE164(phone ?? "")
  const m = e164?.match(/^\+1(\d{3})\d{7}$/)
  return m ? m[1] : null
}

const BRAND_EVENT_TYPES = [
  "com.twilio.messaging.compliance.brand-registration.brand-failure",
  "com.twilio.messaging.compliance.brand-registration.brand-registered",
  "com.twilio.messaging.compliance.brand-registration.brand-unverified",
  "com.twilio.messaging.compliance.brand-registration.brand-vetted-verified",
  "com.twilio.messaging.compliance.brand-registration.brand-secondary-vetting-failure",
  "com.twilio.messaging.compliance.brand-registration.brand-verified",
]
const CAMPAIGN_EVENT_TYPES = [
  "com.twilio.messaging.compliance.campaign-registration.campaign-submitted",
  "com.twilio.messaging.compliance.campaign-registration.campaign-failure",
  "com.twilio.messaging.compliance.campaign-registration.campaign-approved",
]
const NUMBER_EVENT_TYPES = [
  "com.twilio.messaging.compliance.number-registration.pending",
  "com.twilio.messaging.compliance.number-registration.successful",
  "com.twilio.messaging.compliance.number-registration.failed",
]
export const REGISTRATION_EVENT_TYPES = [...BRAND_EVENT_TYPES, ...CAMPAIGN_EVENT_TYPES, ...NUMBER_EVENT_TYPES]

// ---- Lease -------------------------------------------------------------------

async function claimLease(orgId: string): Promise<OrgTwilio | null> {
  const now = new Date()
  const { data, error } = await supabaseAdmin
    .from("org_twilio")
    .update({ advancing_until: new Date(now.getTime() + LEASE_MS).toISOString() })
    .eq("org_id", orgId)
    .or(`advancing_until.is.null,advancing_until.lt.${now.toISOString()}`)
    .select("*")
  if (error) throw new Error(`org_twilio lease failed: ${error.message}`)
  const rows = (data ?? []) as OrgTwilio[]
  return rows[0] ?? null
}

async function releaseLease(orgId: string) {
  const { error } = await supabaseAdmin.from("org_twilio").update({ advancing_until: null }).eq("org_id", orgId)
  if (error) console.error("[org-twilio-engine] lease release failed", { orgId, error })
}

// ---- Stage writes --------------------------------------------------------------

async function setStage(
  orgId: string,
  row: OrgTwilio,
  stage: OrgTwilioSetupStage,
  patch: OrgTwilioPatch = {},
): Promise<OrgTwilio> {
  const updated = await upsertOrgTwilio(orgId, {
    ...patch,
    setup_stage: stage,
    a2p_status: legacyA2pStatus(stage),
    last_checked_at: new Date().toISOString(),
  })
  Object.assign(row, updated)
  return row
}

async function actionRequired(
  orgId: string,
  row: OrgTwilio,
  issues: CustomerIssue[],
  patch: OrgTwilioPatch = {},
  opts: { stage?: OrgTwilioSetupStage } = {},
) {
  const stage: OrgTwilioSetupStage =
    opts.stage ?? (issues.length && issues.every((i) => !i.fixable) ? "rejected" : "action_required")
  await setStage(orgId, row, stage, { ...patch, customer_issues: issues, next_check_at: null })

  // Tell the customer once per distinct set of issues.
  const hash = issuesHash(issues)
  const state = row.provisioning_state ?? {}
  if (state.issue_hash !== hash) {
    try {
      await notifyActionRequired(orgId, issues)
    } catch (err) {
      console.error("[org-twilio-engine] action-required notify failed", { orgId }, err)
    }
    await mergeProvisioningState(orgId, { issue_hash: hash }, { issue_notified_at: new Date().toISOString() })
  }
  return stage
}

// ---- Steps ---------------------------------------------------------------------

async function ensureEventStreams(client: Twilio, orgId: string, row: OrgTwilio) {
  if (row.event_sink_sid && row.event_subscription_sid) return
  const base = baseUrl()
  if (!base) return
  try {
    let sinkSid = row.event_sink_sid
    if (!sinkSid) {
      const destination = `${base}/api/webhooks/twilio-events?org=${encodeURIComponent(orgId)}&sig=${eventsSignature(orgId)}`
      const sink = await client.events.v1.sinks.create({
        description: "listhit-registration",
        sinkType: "webhook",
        sinkConfiguration: { destination, method: "POST", batch_events: false },
      })
      sinkSid = sink.sid
      await upsertOrgTwilio(orgId, { event_sink_sid: sinkSid })
      row.event_sink_sid = sinkSid
    }
    if (!row.event_subscription_sid) {
      const sub = await client.events.v1.subscriptions.create({
        description: "listhit-registration",
        sinkSid,
        types: REGISTRATION_EVENT_TYPES.map((type) => ({ type })),
      })
      await upsertOrgTwilio(orgId, { event_subscription_sid: sub.sid })
      row.event_subscription_sid = sub.sid
    }
  } catch (err) {
    // Non-fatal: the polling cron still advances the org.
    console.error("[org-twilio-engine] Event Streams setup failed (cron fallback)", { orgId, error: internalMessage(err) })
  }
}

async function ensureMessagingService(client: Twilio, orgId: string, row: OrgTwilio, displayName: string): Promise<string> {
  if (row.messaging_service_sid) return row.messaging_service_sid
  const base = baseUrl()
  const service = await client.messaging.v1.services.create({
    friendlyName: `${displayName} — Texting (org ${orgId})`.slice(0, 64),
    ...(base ? { inboundRequestUrl: `${base}/api/webhooks/twilio-incoming-sms` } : {}),
    ...(base ? { statusCallback: `${base}/api/webhooks/twilio-status` } : {}),
    useInboundWebhookOnNumber: false,
    stickySender: true,
    smartEncoding: true,
    areaCodeGeomatch: true,
  })
  await mergeProvisioningState(orgId, { messaging_service_sid: service.sid }, { messaging_service_sid: service.sid })
  row.messaging_service_sid = service.sid
  return service.sid
}

async function ensureDrafts(
  client: Twilio,
  orgId: string,
  row: OrgTwilio,
  state: ProvisioningState,
  brandType: BrandType,
  data: RegistrationData,
  websiteUrl: string,
  sync: boolean,
): Promise<DraftResult> {
  const opts = { sync, profileStatus: row.customer_profile_status, trustProductStatus: row.trust_product_status }
  return brandType === BRAND_TYPE_SOLE_PROPRIETOR
    ? ensureSoleProprietorDrafts(client, orgId, state, soleProprietorInputsFrom(data), opts)
    : ensureStandardDrafts(client, orgId, state, standardInputsFrom(data, websiteUrl), opts)
}

// A failed draft evaluation. When every reason is Twilio sequencing (e.g. the
// TrustProduct ran before the profile reached review) there is nothing for the
// customer to fix: log it, stay in submitting, and retry shortly.
async function draftNotCompliant(orgId: string, row: OrgTwilio, results: unknown): Promise<OrgTwilioSetupStage> {
  const issues = issuesFromEvaluation(results)
  if (issues.length) return actionRequired(orgId, row, issues)
  console.warn("[org-twilio-engine] Trust Hub evaluation hit a sequencing failure; retrying", { orgId })
  await setStage(orgId, row, "submitting", { next_check_at: inMinutes(5) })
  return "submitting"
}

// ---- Entry point -----------------------------------------------------------------

export async function advanceRegistration(orgId: string, opts: { reason: string } = { reason: "manual" }): Promise<AdvanceResult> {
  // The owner org runs on Telnyx and is never registered with Twilio.
  if (!orgId || isOrgTelnyxPinnedEnv(orgId)) return { stage: "not_started", changed: false }

  const row = await claimLease(orgId)
  if (!row) {
    const current = await getOrgTwilio(orgId).catch(() => null)
    return { stage: (current?.setup_stage ?? "not_started") as OrgTwilioSetupStage, changed: false }
  }

  const before = row.setup_stage
  try {
    const stage = await runSteps(orgId, row, opts.reason)
    return { stage, changed: stage !== before }
  } finally {
    await releaseLease(orgId)
  }
}

async function runSteps(orgId: string, row: OrgTwilio, reason: string): Promise<OrgTwilioSetupStage> {
  if (!row.submitted_at) {
    if (row.setup_stage !== "not_started") await setStage(orgId, row, "not_started")
    return "not_started"
  }

  const brandType: BrandType = row.brand_type === BRAND_TYPE_SOLE_PROPRIETOR ? BRAND_TYPE_SOLE_PROPRIETOR : BRAND_TYPE_STANDARD
  const state: ProvisioningState = { ...(row.provisioning_state ?? {}) }
  row.provisioning_state = state

  try {
    // 1. Subaccount + voice credentials (free).
    await ensureOrgSubaccount(orgId)
    await ensureOrgVoiceCredentials(orgId)
    const client = await getTwilioClientForOrg(orgId)

    // 2. Event Streams (free, non-fatal).
    await ensureEventStreams(client, orgId, row)

    const data = await loadRegistrationData(orgId)
    const displayName =
      String(data.bv?.dba_name || data.bv?.legal_business_name || data.org?.business_name || data.org?.name || "ListHit customer").trim()

    // 3. Messaging Service (free).
    const mgSid = await ensureMessagingService(client, orgId, row, displayName)

    // 4. Trust Hub drafts, evaluation and submission for review (free). Skipped
    //    once both are submitted. Data is only re-synced before the profile is
    //    submitted; later edits go through resubmitRegistration.
    if (!state.trust_hub_submitted_at) {
      let websiteUrl = String(data.org?.website_url ?? "").trim()
      if (brandType === BRAND_TYPE_STANDARD) {
        const urls = await resolveComplianceUrls(orgId)
        if ("error" in urls) {
          return actionRequired(orgId, row, [
            { field: "website", message: "Publish your ListHit website, or add your website with links to its privacy policy and terms.", fixable: true },
          ])
        }
        websiteUrl = urls.websiteUrl
      }
      const sync = !isInOrPastReview(row.customer_profile_status)
      const draft = await ensureDrafts(client, orgId, row, state, brandType, data, websiteUrl, sync)
      if (!draft.compliant) return draftNotCompliant(orgId, row, draft.results)
    }

    // 5. SPEND GATE — nothing that costs money happens before a platform admin approves.
    if (!row.spend_approved_at) {
      await setStage(orgId, row, "awaiting_approval", { customer_issues: null, next_check_at: null })
      if (!state.admin_notified_at) {
        try {
          await notifyPlatformAdminsAwaitingApproval(orgId, brandType)
        } catch (err) {
          console.error("[org-twilio-engine] admin notify failed", { orgId }, err)
        }
        await mergeProvisioningState(orgId, { admin_notified_at: new Date().toISOString() })
        state.admin_notified_at = new Date().toISOString()
      }
      return "awaiting_approval"
    }

    if (row.setup_stage === "awaiting_approval" || row.setup_stage === "not_started") {
      await setStage(orgId, row, "submitting")
    }

    // 6. Safety net: step 4 already submits Trust Hub; this only runs if it didn't finish.
    if (!state.trust_hub_submitted_at) {
      await submitTrustHub(client, orgId, state, {
        profileStatus: row.customer_profile_status,
        trustProductStatus: row.trust_product_status,
      })
    }

    // 7. Number — buy early so calls work while texting is in review.
    await ensureNumber(client, orgId, row, mgSid, data)

    // 8. Brand.
    const brand = await syncBrand(client, orgId, row, state, brandType)

    // 9. Brand outcomes.
    if (brand.status === "FAILED") {
      return actionRequired(orgId, row, issuesFromBrandErrors(brand.errors))
    }
    if (brand.status === "SUSPENDED") {
      await setStage(orgId, row, "rejected", { next_check_at: null })
      return "rejected"
    }
    if (brand.status !== "APPROVED") {
      await setStage(orgId, row, "in_review", { customer_issues: null, next_check_at: inMinutes(15) })
      return "in_review"
    }
    if (brandType === BRAND_TYPE_SOLE_PROPRIETOR && !brandIsVerified(brand.identityStatus)) {
      await setStage(orgId, row, "verify_mobile", { customer_issues: null, next_check_at: inMinutes(5) })
      return "verify_mobile"
    }

    // 10. Campaign — only after the brand is APPROVED (and VERIFIED for sole prop).
    if (!row.campaign_sid) {
      const created = await createCampaign(client, orgId, row, brandType, data)
      if (created !== "created") return created
    }

    // 11. Campaign status — always re-fetched; event payloads are never trusted.
    await throttle()
    const campaign = await client.messaging.v1.services(mgSid).usAppToPerson(row.campaign_sid!).fetch()
    const campaignPatch: OrgTwilioPatch = {
      campaign_status: campaign.campaignStatus,
      campaign_errors: Array.isArray(campaign.errors) ? (campaign.errors as unknown[]) : null,
    }
    await mergeProvisioningState(orgId, { campaign_status: campaign.campaignStatus }, campaignPatch)
    Object.assign(row, campaignPatch)

    if (campaign.campaignStatus === "VERIFIED") {
      await setStage(orgId, row, "live", {
        live_at: row.live_at ?? new Date().toISOString(),
        customer_issues: null,
        next_check_at: null,
        provisioning_error: null,
      })
      if (!row.live_notified_at) {
        try {
          await notifyLive(orgId, row.phone_number)
        } catch (err) {
          console.error("[org-twilio-engine] live notify failed", { orgId }, err)
        }
        await upsertOrgTwilio(orgId, { live_notified_at: new Date().toISOString() })
      }
      return "live"
    }
    if (campaign.campaignStatus === "FAILED") {
      return actionRequired(orgId, row, issuesFromCampaignErrors(campaign.errors))
    }

    await setStage(orgId, row, "in_review", { customer_issues: null, next_check_at: inMinutes(30) })
    return "in_review"
  } catch (err) {
    console.error("[org-twilio-engine] advance failed", { orgId, reason, error: internalMessage(err) })
    const status = errorStatus(err)
    const code = errorCode(err)
    const patch: OrgTwilioPatch = { provisioning_error: internalMessage(err), next_check_at: inMinutes(15) }

    // A recognized 4xx is something the customer can act on; everything else
    // (5xx, network, unknown) is retried later without changing the stage.
    if (status && status >= 400 && status < 500 && code) {
      const [issue] = issuesFromBrandErrors([{ error_code: code, description: "" }])
      if (issue && issue.field !== "other") {
        await upsertOrgTwilio(orgId, patch)
        return actionRequired(orgId, row, [issue])
      }
    }
    await upsertOrgTwilio(orgId, { ...patch, last_checked_at: new Date().toISOString() })
    return row.setup_stage
  }
}

// ---- Paid steps (only reached after the spend gate in runSteps) -------------------

async function defaultMarketId(orgId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("markets").select("id").eq("org_id", orgId).eq("name", "Default").maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

async function recordNumber(
  client: Twilio,
  orgId: string,
  row: OrgTwilio,
  mgSid: string,
  number: { sid: string; phoneNumber: string; accountSid: string },
  addToService: boolean,
) {
  const e164 = formatPhoneE164(number.phoneNumber) || number.phoneNumber
  // Write the number first so a crash after this point can never buy a second one.
  await mergeProvisioningState(
    orgId,
    { phone_number: e164, phone_number_sid: number.sid },
    { phone_number: e164, phone_number_sid: number.sid },
  )
  row.phone_number = e164
  row.phone_number_sid = number.sid

  // In the Messaging Service BEFORE the campaign exists: Twilio registers every
  // number in the service when the campaign is approved.
  if (addToService) {
    await client.messaging.v1.services(mgSid).phoneNumbers.create({ phoneNumberSid: number.sid })
  }

  const marketId = await defaultMarketId(orgId)
  const { error } = await supabaseAdmin.from("inbound_numbers").insert({
    e164,
    org_id: orgId,
    enabled: true,
    provider: "twilio",
    twilio_account_sid: number.accountSid,
    twilio_phone_number_sid: number.sid,
    ...(marketId ? { market_id: marketId } : {}),
  })
  if (error && (error as { code?: string }).code !== "23505") {
    console.error("[org-twilio-engine] inbound_numbers insert failed", { orgId, error })
  }
}

// Buy (or adopt) the org's one number. Voice works immediately; texting turns on
// when the campaign is approved.
async function ensureNumber(client: Twilio, orgId: string, row: OrgTwilio, mgSid: string, data: RegistrationData) {
  if (row.phone_number) return

  // A number already in the subaccount (a crash after purchase, or sole prop's
  // single number) is adopted, never duplicated.
  const owned = await client.incomingPhoneNumbers.list({ limit: 1 })
  if (owned.length) {
    await recordNumber(client, orgId, row, mgSid, owned[0], true)
    return
  }

  const voiceUrl = `${baseUrl()}/api/webhooks/twilio-voice-incoming`
  const buy = (phoneNumber: string) =>
    client.incomingPhoneNumbers.create({ phoneNumber, voiceUrl, voiceMethod: "POST" })

  let bought: { sid: string; phoneNumber: string; accountSid: string } | null = null
  const desired = formatPhoneE164(row.desired_phone_number ?? "")
  if (desired) {
    try {
      bought = await buy(desired)
    } catch (err) {
      console.warn("[org-twilio-engine] desired number unavailable; searching the same area", {
        orgId,
        error: internalMessage(err),
      })
    }
  }

  if (!bought) {
    const areaCode = (row.desired_area_code ?? "").trim() || areaCodeOf(desired) || null
    const { results: candidates } = await searchLocalNumbers(client, {
      areaCode,
      nearPhone: formatPhoneE164(String(data.org?.phone ?? "")),
      postalCode: String(data.org?.zip ?? "").trim(),
      state: String(data.org?.state ?? "").trim(),
      limit: 1,
    })
    if (!candidates.length) throw Object.assign(new Error("No available numbers for the requested area."), { status: 503 })
    bought = await buy(candidates[0].phoneNumber)
  }

  await recordNumber(client, orgId, row, mgSid, bought, true)
}

function brandIsVerified(identityStatus: string | null | undefined) {
  return identityStatus === "VERIFIED" || identityStatus === "VETTED_VERIFIED"
}

async function syncBrand(client: Twilio, orgId: string, row: OrgTwilio, state: ProvisioningState, brandType: BrandType) {
  let brand
  if (!row.brand_sid) {
    await throttle()
    brand = await client.messaging.v1.brandRegistrations.create({
      customerProfileBundleSid: state.secondary_profile_sid!,
      a2PProfileBundleSid: state.trust_product_sid!,
      brandType,
      mock: Boolean(row.mock_registration),
    })
  } else {
    await throttle()
    brand = await client.messaging.v1.brandRegistrations(row.brand_sid).fetch()
  }

  const patch: OrgTwilioPatch = {
    brand_sid: brand.sid,
    brand_status: brand.status,
    brand_identity_status: brand.identityStatus ?? null,
    brand_errors: Array.isArray(brand.errors) ? brand.errors : null,
  }
  await mergeProvisioningState(
    orgId,
    { brand_registration_sid: brand.sid, brand_status: brand.status, ...(brand.tcrId ? { tcr_id: brand.tcrId } : {}) },
    patch,
  )
  Object.assign(row, patch)
  if (brand.tcrId) state.tcr_id = brand.tcrId
  return brand
}

async function createCampaign(
  client: Twilio,
  orgId: string,
  row: OrgTwilio,
  brandType: BrandType,
  data: RegistrationData,
): Promise<"created" | OrgTwilioSetupStage> {
  const urls = await resolveComplianceUrls(orgId)
  if ("error" in urls) {
    return actionRequired(orgId, row, [
      { field: "website", message: "Publish your ListHit website, or add your website with links to its privacy policy and terms.", fixable: true },
    ])
  }

  const reg = data.a2p ?? {}
  const brandNames = brandNamesFrom(data, brandType)
  const displayName =
    brandType === BRAND_TYPE_SOLE_PROPRIETOR
      ? soleProprietorBrandName(soleProprietorInputsFrom(data))
      : String(data.bv?.dba_name || data.bv?.legal_business_name || data.org?.business_name || "").trim()
  const messageFlow =
    String(reg.message_flow ?? "").trim() ||
    buildMessageFlow({
      brandName: displayName,
      siteUrl: urls.websiteUrl,
      privacyUrl: urls.privacyUrl,
      termsUrl: urls.termsUrl,
      hasListHitSite: urls.hasListHitSite,
    })

  let attrs: Record<string, unknown>
  try {
    attrs = buildCampaignAttributes({
      brandRegistrationSid: row.brand_sid!,
      brandType,
      description: String(reg.campaign_description ?? "").trim() || null,
      samples: [reg.sample_message_1, reg.sample_message_2, reg.sample_message_3, reg.sample_message_4, reg.sample_message_5],
      legalBusinessName: String(data.bv?.legal_business_name || displayName),
      brandNames,
      messageFlow,
      privacyPolicyUrl: urls.privacyUrl,
      termsUrl: urls.termsUrl,
    })
  } catch (err) {
    if (err instanceof CampaignContentError) {
      return actionRequired(
        orgId,
        row,
        err.issues.map((i) => ({
          field: i.field === "message_flow" ? "message_flow" : "samples",
          message: i.message,
          fixable: true,
        })),
      )
    }
    throw err
  }

  // Record exactly what we submit, for transparency.
  const { error: regErr } = await supabaseAdmin
    .from("a2p_registration")
    .update({ message_flow: messageFlow, privacy_policy_url: urls.privacyUrl, terms_url: urls.termsUrl })
    .eq("org_id", orgId)
  if (regErr) console.error("[org-twilio-engine] a2p_registration write failed", { orgId, error: regErr })

  // Campaigns are only ever filed against an approved brand.
  if (row.brand_status !== "APPROVED") throw new Error("Campaign creation requires an APPROVED brand.")
  await throttle()
  // A campaign under a mock brand is created as a mock automatically; the SDK
  // has no `mock` create param for campaigns.
  const campaign = await client.messaging.v1
    .services(row.messaging_service_sid!)
    .usAppToPerson.create({ ...attrs, xTwilioApiVersion: "v1.2" } as unknown as UsAppToPersonListInstanceCreateOptions)

  const patch: OrgTwilioPatch = { campaign_sid: campaign.sid, campaign_status: campaign.campaignStatus }
  await mergeProvisioningState(orgId, { campaign_sid: campaign.sid, campaign_status: campaign.campaignStatus }, patch)
  Object.assign(row, patch)
  return "created"
}

// ---- Resubmit ----------------------------------------------------------------------

export async function resubmitRegistration(orgId: string): Promise<AdvanceResult> {
  if (!orgId || isOrgTelnyxPinnedEnv(orgId)) return { stage: "not_started", changed: false }

  const row = await claimLease(orgId)
  if (!row) {
    const current = await getOrgTwilio(orgId).catch(() => null)
    return { stage: (current?.setup_stage ?? "not_started") as OrgTwilioSetupStage, changed: false }
  }

  let stop: OrgTwilioSetupStage | null = null
  try {
    if (!row.submitted_at) return { stage: row.setup_stage, changed: false }
    const brandType: BrandType = row.brand_type === BRAND_TYPE_SOLE_PROPRIETOR ? BRAND_TYPE_SOLE_PROPRIETOR : BRAND_TYPE_STANDARD
    const state: ProvisioningState = { ...(row.provisioning_state ?? {}) }
    row.provisioning_state = state
    const brandFailed = row.brand_status === "FAILED"

    // Out of free brand resubmissions: stop before touching Twilio.
    if (brandFailed && (row.brand_update_count ?? 0) >= 3) {
      // action_required (not rejected): support can still continue the registration.
      stop = await actionRequired(
        orgId,
        row,
        [{ field: "other", message: RESUBMISSIONS_EXHAUSTED_MESSAGE, fixable: false }],
        {},
        { stage: "action_required" },
      )
      return { stage: stop, changed: stop !== row.setup_stage }
    }

    try {
      const client = await getTwilioClientForOrg(orgId)
      const data = await loadRegistrationData(orgId)

      // Push the corrected data onto the existing Trust Hub objects, re-evaluate,
      // and send them back to review.
      if (state.secondary_profile_sid) {
        let websiteUrl = String(data.org?.website_url ?? "").trim()
        if (brandType === BRAND_TYPE_STANDARD) {
          const urls = await resolveComplianceUrls(orgId)
          if (!("error" in urls)) websiteUrl = urls.websiteUrl
        }
        // Synced bundles are re-submitted inside ensureDrafts.
        const draft = await ensureDrafts(client, orgId, row, state, brandType, data, websiteUrl, true)
        if (!draft.compliant) {
          stop = await draftNotCompliant(orgId, row, draft.results)
          return { stage: stop, changed: true }
        }
      }

      // A failed brand gets up to 3 free resubmissions (needs a TCR id).
      if (brandFailed && row.brand_sid && state.tcr_id) {
        await throttle()
        const brand = await client.messaging.v1.brandRegistrations(row.brand_sid).update()
        await upsertOrgTwilio(orgId, {
          brand_update_count: (row.brand_update_count ?? 0) + 1,
          brand_status: brand.status,
          brand_errors: Array.isArray(brand.errors) ? brand.errors : null,
        })
      }

      // A failed campaign is deleted and recreated by the next advance. Only when
      // every issue is fixable — recreating charges the vetting fee again.
      if (row.campaign_status === "FAILED" && row.campaign_sid && row.messaging_service_sid) {
        const campaignIssues = issuesFromCampaignErrors(row.campaign_errors)
        if (campaignIssues.every((i) => i.fixable)) {
          console.warn("[org-twilio-engine] deleting failed campaign for recreation — this incurs a new vetting fee", { orgId })
          await throttle()
          await client.messaging.v1.services(row.messaging_service_sid).usAppToPerson(row.campaign_sid).remove()
          await mergeProvisioningState(
            orgId,
            { campaign_sid: undefined, campaign_status: undefined },
            { campaign_sid: null, campaign_status: null, campaign_errors: null },
          )
        }
      }

      await setStage(orgId, row, row.spend_approved_at ? "submitting" : "awaiting_approval", {
        customer_issues: null,
        next_check_at: null,
      })
    } catch (err) {
      console.error("[org-twilio-engine] resubmit failed", { orgId, error: internalMessage(err) })
      await upsertOrgTwilio(orgId, { provisioning_error: internalMessage(err), next_check_at: inMinutes(15) })
      return { stage: row.setup_stage, changed: false }
    }
  } finally {
    await releaseLease(orgId)
  }

  return advanceRegistration(orgId, { reason: "resubmit" })
}

// ---- Sole proprietor OTP -------------------------------------------------------------

export class OtpRateLimitedError extends Error {
  constructor() {
    super("Wait a minute before requesting another text.")
    this.name = "OtpRateLimitedError"
  }
}

export async function resendSoleProprietorOtp(orgId: string): Promise<{ sent: boolean }> {
  if (!orgId || isOrgTelnyxPinnedEnv(orgId)) return { sent: false }
  const row = await getOrgTwilio(orgId)
  if (!row || row.setup_stage !== "verify_mobile" || !row.brand_sid) return { sent: false }

  const last = row.provisioning_state?.otp_requested_at ? Date.parse(row.provisioning_state.otp_requested_at) : 0
  if (last && Date.now() - last < MINUTE) throw new OtpRateLimitedError()

  await mergeProvisioningState(orgId, { otp_requested_at: new Date().toISOString() })
  const client = await getTwilioClientForOrg(orgId)
  await throttle()
  await client.messaging.v1.brandRegistrations(row.brand_sid).brandRegistrationOtps.create()
  return { sent: true }
}
