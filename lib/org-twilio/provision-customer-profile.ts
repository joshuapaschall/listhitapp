import "server-only"

import { supabaseAdmin } from "@/lib/supabase"
import { getTwilioClient, getListHitPrimaryProfileSid } from "@/lib/providers/twilio/client"
import { getOrgTwilio, upsertOrgTwilio, mergeProvisioningState } from "@/lib/org-twilio/service"
import type { ProvisioningState } from "@/lib/org-twilio/types"
import {
  SECONDARY_CUSTOMER_PROFILE_POLICY_SID,
  buildBusinessInformationAttributes,
  buildAuthorizedRepAttributes,
  buildAddressParams,
  validateProvisioningInputs,
  summarizeEvaluationFailures,
  type ProvisioningInputs,
} from "@/lib/org-twilio/twilio-attributes"

export interface ProvisionResult {
  ok: boolean
  secondaryProfileSid?: string
  status?: string
  error?: string
  evaluation?: "compliant" | "noncompliant"
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

// LISTHIT-owned notification email for CP status updates (never the tenant's).
function resolveNotifyEmail(): string {
  return process.env.LISTHIT_TWILIO_NOTIFY_EMAIL || "compliance@listhit.io"
}

// Shared-secret status-callback URL. Returns undefined when no base URL is set
// (so we never register a relative/invalid callback on the CustomerProfile).
function resolveStatusCallbackUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || ""
  if (!base) return undefined
  const token = process.env.LISTHIT_TWILIO_STATUS_CALLBACK_TOKEN || process.env.CRON_SECRET || ""
  return `${base.replace(/\/$/, "")}/api/webhooks/twilio-trusthub?token=${encodeURIComponent(token)}`
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string | number }
    const code = e.code != null ? ` (code ${e.code})` : ""
    if (e.message) return `${e.message}${code}`
  }
  return "Unknown Twilio error"
}

export async function provisionCustomerProfile(orgId: string): Promise<ProvisionResult> {
  // 1. Gate — load tenant source rows live (org-scoped). No Twilio calls yet.
  const [{ data: bv }, { data: org }, { data: a2p }] = await Promise.all([
    supabaseAdmin.from("business_verification").select("*").eq("org_id", orgId).maybeSingle(),
    supabaseAdmin.from("organizations").select("*").eq("id", orgId).maybeSingle(),
    supabaseAdmin.from("a2p_registration").select("*").eq("org_id", orgId).maybeSingle(),
  ])

  if (!bv || bv.status !== "ready") {
    return { ok: false, error: "Business verification is not ready." }
  }
  if (!a2p || a2p.status !== "ready") {
    return { ok: false, error: "A2P registration is not ready." }
  }

  const inputs: ProvisioningInputs = {
    legalBusinessName: str(bv.legal_business_name),
    ein: str(bv.ein),
    businessType: str(bv.business_type) || null,
    contactFirstName: str(bv.contact_first_name),
    contactLastName: str(bv.contact_last_name),
    contactEmail: str(bv.contact_email),
    orgPhone: str(org?.phone),
    addressLine1: str(org?.address_line1),
    addressLine2: str(org?.address_line2) || null,
    city: str(org?.city),
    state: str(org?.state),
    zip: str(org?.zip),
    websiteUrl: str(org?.website_url),
  }

  const validation = validateProvisioningInputs(inputs)
  if (!validation.ok) {
    return { ok: false, error: `Missing required business details: ${validation.missing.join(", ")}.` }
  }

  // 2. Mark provisioning + clear prior error before any external work.
  await upsertOrgTwilio(orgId, { a2p_status: "provisioning", provisioning_error: null })

  // 3. Read current state for idempotent resume.
  const existing = await getOrgTwilio(orgId)
  const state: ProvisioningState = { ...(existing?.provisioning_state ?? {}) }

  const client = getTwilioClient()
  const legalName = inputs.legalBusinessName
  const notifyEmail = resolveNotifyEmail()
  const statusCallbackUrl = resolveStatusCallbackUrl()

  try {
    // 1.1 — CustomerProfile
    if (!state.secondary_profile_sid) {
      const cp = await client.trusthub.v1.customerProfiles.create({
        friendlyName: `${legalName} — Secondary Customer Profile (org ${orgId})`,
        email: notifyEmail,
        policySid: SECONDARY_CUSTOMER_PROFILE_POLICY_SID,
        ...(statusCallbackUrl ? { statusCallback: statusCallbackUrl } : {}),
      })
      state.secondary_profile_sid = cp.sid
      await mergeProvisioningState(orgId, { secondary_profile_sid: cp.sid }, {
        secondary_profile_sid: cp.sid,
        customer_profile_status: cp.status,
      })
    }
    const secondaryProfileSid = state.secondary_profile_sid

    // 1.2 — Business-information EndUser (create or update in place)
    if (!state.business_info_enduser_sid) {
      const eu = await client.trusthub.v1.endUsers.create({
        friendlyName: `${legalName} — Business Information`,
        type: "customer_profile_business_information",
        attributes: buildBusinessInformationAttributes(inputs),
      })
      state.business_info_enduser_sid = eu.sid
      await mergeProvisioningState(orgId, { business_info_enduser_sid: eu.sid })
    } else {
      await client.trusthub.v1.endUsers(state.business_info_enduser_sid).update({ attributes: buildBusinessInformationAttributes(inputs) })
    }

    // 1.3 — Attach business-info EndUser
    if (!state.business_info_attached) {
      await client.trusthub.v1
        .customerProfiles(secondaryProfileSid)
        .customerProfilesEntityAssignments.create({ objectSid: state.business_info_enduser_sid! })
      state.business_info_attached = true
      await mergeProvisioningState(orgId, { business_info_attached: true })
    }

    // 1.4 — Authorized-rep EndUser (create or update in place)
    if (!state.authorized_rep_enduser_sid) {
      const rep = await client.trusthub.v1.endUsers.create({
        friendlyName: `${legalName} — Authorized Rep 1`,
        type: "authorized_representative_1",
        attributes: buildAuthorizedRepAttributes(inputs),
      })
      state.authorized_rep_enduser_sid = rep.sid
      await mergeProvisioningState(orgId, { authorized_rep_enduser_sid: rep.sid })
    } else {
      await client.trusthub.v1.endUsers(state.authorized_rep_enduser_sid).update({ attributes: buildAuthorizedRepAttributes(inputs) })
    }

    // 1.5 — Attach authorized-rep EndUser
    if (!state.authorized_rep_attached) {
      await client.trusthub.v1
        .customerProfiles(secondaryProfileSid)
        .customerProfilesEntityAssignments.create({ objectSid: state.authorized_rep_enduser_sid! })
      state.authorized_rep_attached = true
      await mergeProvisioningState(orgId, { authorized_rep_attached: true })
    }

    // 1.6 — Address (create or update in place; on the account, not trusthub)
    if (!state.address_sid) {
      const addr = await client.addresses.create({
        friendlyName: `${legalName} — Mailing Address`,
        ...buildAddressParams(inputs),
      })
      state.address_sid = addr.sid
      await mergeProvisioningState(orgId, { address_sid: addr.sid })
    } else {
      await client.addresses(state.address_sid).update({ ...buildAddressParams(inputs) })
    }

    // 1.7 — SupportingDocument (address proof)
    if (!state.supporting_document_sid) {
      const doc = await client.trusthub.v1.supportingDocuments.create({
        friendlyName: `${legalName} — Address Document`,
        type: "customer_profile_address",
        attributes: { address_sids: state.address_sid },
      })
      state.supporting_document_sid = doc.sid
      await mergeProvisioningState(orgId, { supporting_document_sid: doc.sid })
    }

    // 1.8 — Attach SupportingDocument
    if (!state.supporting_document_attached) {
      await client.trusthub.v1
        .customerProfiles(secondaryProfileSid)
        .customerProfilesEntityAssignments.create({ objectSid: state.supporting_document_sid! })
      state.supporting_document_attached = true
      await mergeProvisioningState(orgId, { supporting_document_attached: true })
    }

    // 1.9 — Assign ListHit Primary Profile (the ISV link)
    if (!state.primary_profile_assigned) {
      await client.trusthub.v1
        .customerProfiles(secondaryProfileSid)
        .customerProfilesEntityAssignments.create({ objectSid: getListHitPrimaryProfileSid() })
      state.primary_profile_assigned = true
      await mergeProvisioningState(orgId, { primary_profile_assigned: true })
    }

    // 1.10 — Evaluate
    const evaluation = await client.trusthub.v1
      .customerProfiles(secondaryProfileSid)
      .customerProfilesEvaluations.create({ policySid: SECONDARY_CUSTOMER_PROFILE_POLICY_SID })
    const evalStatus = evaluation.status === "compliant" ? "compliant" : "noncompliant"
    await mergeProvisioningState(orgId, {
      last_evaluation_status: evalStatus,
      last_evaluation_at: new Date().toISOString(),
    })

    if (evalStatus !== "compliant") {
      const summary = summarizeEvaluationFailures(evaluation.results)
      await upsertOrgTwilio(orgId, { a2p_status: "failed", provisioning_error: summary })
      return { ok: false, evaluation: "noncompliant", error: summary }
    }

    // 1.11 — Submit (move CP to review). Keep a2p_status = provisioning (T3 advances).
    if (!state.submitted) {
      const submitted = await client.trusthub.v1
        .customerProfiles(secondaryProfileSid)
        .update({ status: "pending-review" })
      state.submitted = true
      await mergeProvisioningState(
        orgId,
        { submitted: true, submitted_at: new Date().toISOString() },
        { customer_profile_status: submitted.status },
      )
    }

    return {
      ok: true,
      secondaryProfileSid,
      status: "pending-review",
      evaluation: "compliant",
    }
  } catch (err) {
    const message = errorMessage(err)
    console.error("[provisionCustomerProfile] failed", { orgId, err })
    await upsertOrgTwilio(orgId, { a2p_status: "failed", provisioning_error: message })
    return { ok: false, error: message }
  }
}
