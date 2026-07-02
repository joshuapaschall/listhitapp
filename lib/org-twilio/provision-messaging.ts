import "server-only"

import { supabaseAdmin } from "@/lib/supabase"
import { getTwilioClient } from "@/lib/providers/twilio/client"
import { getOrgTwilio, upsertOrgTwilio, mergeProvisioningState } from "@/lib/org-twilio/service"
import type { ProvisioningState } from "@/lib/org-twilio/types"
import { buildCampaignAttributes, type CampaignInputs } from "@/lib/org-twilio/twilio-attributes"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import type { UsAppToPersonListInstanceCreateOptions } from "twilio/lib/rest/messaging/v1/service/usAppToPerson"

export type MessagingResult = {
  ok: boolean
  messagingServiceSid?: string
  campaignSid?: string
  campaignStatus?: string
  phoneNumber?: string
  waiting?: "brand_approval"
  error?: string
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string | number }
    const code = e.code != null ? ` (code ${e.code})` : ""
    if (e.message) return `${e.message}${code}`
  }
  return "Unknown Twilio error"
}

function trimBase(): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || ""
  return base ? base.replace(/\/$/, "") : ""
}

// The T5 inbound-SMS route path — set on the Messaging Service now so the rail is
// ready to receive once wired. Undefined when no base URL is configured.
function resolveInboundRequestUrl(): string | undefined {
  const base = trimBase()
  return base ? `${base}/api/webhooks/twilio-incoming-sms` : undefined
}

export async function provisionMessaging(orgId: string): Promise<MessagingResult> {
  // 1. Gate — the brand must have been filed (T3a) before messaging can proceed.
  const row = await getOrgTwilio(orgId)
  if (!row?.brand_sid) {
    return { ok: false, error: "Brand not filed yet. File the brand first." }
  }

  // Load tenant source rows (org-scoped) for campaign inputs + legal name.
  const [{ data: reg }, { data: bv }, { data: org }] = await Promise.all([
    supabaseAdmin.from("a2p_registration").select("*").eq("org_id", orgId).maybeSingle(),
    supabaseAdmin.from("business_verification").select("*").eq("org_id", orgId).maybeSingle(),
    supabaseAdmin.from("organizations").select("*").eq("id", orgId).maybeSingle(),
  ])

  const legalName =
    str(bv?.legal_business_name) || str(org?.business_name) || "ListHit Customer"

  const state: ProvisioningState = { ...(row.provisioning_state ?? {}) }
  const client = getTwilioClient()
  const inboundRequestUrl = resolveInboundRequestUrl()

  try {
    // Clear any prior error before external work.
    await upsertOrgTwilio(orgId, { provisioning_error: null })

    // Step 4 — Messaging Service (create a NEW one for A2P; never reuse).
    if (!state.messaging_service_sid && !row.messaging_service_sid) {
      const service = await client.messaging.v1.services.create({
        friendlyName: `${legalName} — A2P Messaging Service (org ${orgId})`,
        ...(inboundRequestUrl ? { inboundRequestUrl } : {}),
      })
      state.messaging_service_sid = service.sid
      await mergeProvisioningState(
        orgId,
        { messaging_service_sid: service.sid },
        { messaging_service_sid: service.sid },
      )
    }
    const mgSid = state.messaging_service_sid || row.messaging_service_sid!

    // Number (flag-gated — purchasing incurs a real monthly charge).
    if (process.env.LISTHIT_TWILIO_PROVISION_NUMBER === "true" && !state.phone_number_sid) {
      const areaCode = process.env.LISTHIT_TWILIO_DEFAULT_AREA_CODE
      const avail = await client.availablePhoneNumbers("US").local.list({
        smsEnabled: true,
        ...(areaCode ? { areaCode: Number(areaCode) } : {}),
        limit: 1,
      })
      if (!avail.length) {
        await upsertOrgTwilio(orgId, {
          provisioning_error: "No available Twilio numbers for the requested area.",
        })
        return { ok: false, error: "No available Twilio numbers for the requested area." }
      }
      const bought = await client.incomingPhoneNumbers.create({ phoneNumber: avail[0].phoneNumber })
      await client.messaging.v1.services(mgSid).phoneNumbers.create({ phoneNumberSid: bought.sid })
      state.phone_number = bought.phoneNumber
      state.phone_number_sid = bought.sid
      await mergeProvisioningState(
        orgId,
        { phone_number: bought.phoneNumber, phone_number_sid: bought.sid },
        { phone_number: bought.phoneNumber, phone_number_sid: bought.sid },
      )

      // Seed inbound_numbers so (a) anon inbound threads resolve to this org via
      // the inbound DID and (b) sticky-sender recognizes it as an allowed from.
      // Non-fatal: the purchase already succeeded and is persisted.
      const e164 = formatPhoneE164(bought.phoneNumber) || bought.phoneNumber
      const { error: seedErr } = await supabaseAdmin
        .from("inbound_numbers")
        .upsert({ e164, org_id: orgId, enabled: true }, { onConflict: "e164" })
      if (seedErr) console.error("[provisionMessaging] inbound_numbers seed failed", { orgId, e164, error: seedErr })
    }

    // Step 5 — A2P Campaign. ONLY after BrandRegistration is APPROVED.
    if (row.brand_status !== "APPROVED") {
      await upsertOrgTwilio(orgId, { a2p_status: "campaign_pending" })
      return { ok: true, messagingServiceSid: mgSid, waiting: "brand_approval" }
    }

    if (!state.campaign_sid && !row.campaign_sid) {
      // Rate-limit safety: Brand/Campaign registration is capped at ≤ 1 req/sec.
      await new Promise((r) => setTimeout(r, 1100))

      // Non-fatal validation/logging of the available use cases for this brand.
      try {
        await client.messaging.v1
          .services(mgSid)
          .usAppToPersonUsecases.fetch({ brandRegistrationSid: row.brand_sid })
      } catch (err) {
        console.warn("[provisionMessaging] usAppToPersonUsecases fetch failed", {
          orgId,
          error: errorMessage(err),
        })
      }

      const base = trimBase()
      const inputs: CampaignInputs = {
        brandRegistrationSid: row.brand_sid,
        useCase: str(reg?.use_case) || null,
        description: str(reg?.campaign_description) || null,
        sample1: str(reg?.sample_message_1) || null,
        sample2: str(reg?.sample_message_2) || null,
        optInUrl: str(reg?.opt_in_url) || null,
        legalBusinessName: legalName,
        privacyPolicyUrl: base ? `${base}/privacy` : null,
        termsUrl: base ? `${base}/terms` : null,
      }

      const campaign = await client.messaging.v1
        .services(mgSid)
        .usAppToPerson.create(
          buildCampaignAttributes(inputs) as unknown as UsAppToPersonListInstanceCreateOptions,
        )
      state.campaign_sid = campaign.sid
      state.campaign_status = campaign.campaignStatus
      await mergeProvisioningState(
        orgId,
        { campaign_sid: campaign.sid, campaign_status: campaign.campaignStatus },
        {
          campaign_sid: campaign.sid,
          campaign_status: campaign.campaignStatus,
          a2p_status: "campaign_pending",
        },
      )
    }

    return {
      ok: true,
      messagingServiceSid: mgSid,
      campaignSid: state.campaign_sid ?? row.campaign_sid ?? undefined,
      campaignStatus: state.campaign_status ?? row.campaign_status ?? undefined,
      phoneNumber: state.phone_number ?? row.phone_number ?? undefined,
    }
  } catch (err) {
    const message = errorMessage(err)
    console.error("[provisionMessaging] failed", { orgId, err })
    await upsertOrgTwilio(orgId, { a2p_status: "failed", provisioning_error: message })
    return { ok: false, error: message }
  }
}
