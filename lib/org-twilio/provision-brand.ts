import "server-only"

import { supabaseAdmin } from "@/lib/supabase"
import { getTwilioClient } from "@/lib/providers/twilio/client"
import { getOrgTwilio, upsertOrgTwilio, mergeProvisioningState } from "@/lib/org-twilio/service"
import type { ProvisioningState } from "@/lib/org-twilio/types"
import {
  TRUST_PRODUCT_POLICY_SID,
  BRAND_TYPE_STANDARD,
  buildA2pMessagingProfileAttributes,
  validateProvisioningInputs,
  summarizeEvaluationFailures,
  type ProvisioningInputs,
} from "@/lib/org-twilio/twilio-attributes"

export type BrandResult = {
  ok: boolean
  trustProductSid?: string
  brandSid?: string
  brandStatus?: string
  error?: string
  evaluation?: "compliant" | "noncompliant"
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

// ListHit-owned compliance address (never the tenant's) used for the TrustProduct
// email and the us_a2p brand_contact_email so all carrier/TCR correspondence
// reaches ListHit.
function resolveRepEmail(): string {
  return (
    process.env.LISTHIT_TWILIO_REP_EMAIL ||
    process.env.LISTHIT_TWILIO_NOTIFY_EMAIL ||
    "compliance@listhit.io"
  )
}

// Shared-secret status-callback URL (reuses the trusthub webhook). Returns
// undefined when no base URL is set so we never register an invalid callback.
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

export async function provisionBrand(orgId: string): Promise<BrandResult> {
  // 1. Gate — the Secondary Customer Profile must exist and have been submitted.
  const row = await getOrgTwilio(orgId)
  if (!row?.provisioning_state?.secondary_profile_sid || row.provisioning_state.submitted !== true) {
    return {
      ok: false,
      error: "Customer profile is not provisioned/submitted yet. Run provision first.",
    }
  }

  // Load tenant source rows live (org-scoped) and assemble inputs like T2 does.
  const [{ data: bv }, { data: org }] = await Promise.all([
    supabaseAdmin.from("business_verification").select("*").eq("org_id", orgId).maybeSingle(),
    supabaseAdmin.from("organizations").select("*").eq("id", orgId).maybeSingle(),
  ])

  const inputs: ProvisioningInputs = {
    legalBusinessName: str(bv?.legal_business_name),
    ein: str(bv?.ein),
    businessType: str(bv?.business_type) || null,
    contactFirstName: str(bv?.contact_first_name),
    contactLastName: str(bv?.contact_last_name),
    contactEmail: str(bv?.contact_email),
    repEmail: resolveRepEmail(),
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

  // 2. Mark brand provisioning + clear prior error before any external work.
  await upsertOrgTwilio(orgId, { a2p_status: "brand_pending", provisioning_error: null })

  const state: ProvisioningState = { ...(row.provisioning_state ?? {}) }
  const secondaryProfileSid = state.secondary_profile_sid!
  const client = getTwilioClient()
  const legalName = inputs.legalBusinessName
  const email = inputs.repEmail
  const statusCallback = resolveStatusCallbackUrl()

  try {
    // 2.1 — TrustProduct (A2P compliance container)
    if (!state.trust_product_sid) {
      const tp = await client.trusthub.v1.trustProducts.create({
        friendlyName: `${legalName} — A2P Trust Product (org ${orgId})`,
        email,
        policySid: TRUST_PRODUCT_POLICY_SID,
        ...(statusCallback ? { statusCallback } : {}),
      })
      state.trust_product_sid = tp.sid
      await mergeProvisioningState(orgId, { trust_product_sid: tp.sid }, { trust_product_sid: tp.sid })
    }
    const tpSid = state.trust_product_sid

    // 2.2 — us_a2p messaging-profile EndUser (create or update in place)
    if (!state.a2p_profile_enduser_sid) {
      const eu = await client.trusthub.v1.endUsers.create({
        friendlyName: `${legalName} — A2P Messaging Profile`,
        type: "us_a2p_messaging_profile_information",
        attributes: buildA2pMessagingProfileAttributes(inputs),
      })
      state.a2p_profile_enduser_sid = eu.sid
      await mergeProvisioningState(orgId, { a2p_profile_enduser_sid: eu.sid })
    } else {
      await client.trusthub.v1
        .endUsers(state.a2p_profile_enduser_sid)
        .update({ attributes: buildA2pMessagingProfileAttributes(inputs) })
    }

    // 2.3 — Attach the us_a2p EndUser to the TrustProduct
    if (!state.a2p_profile_attached) {
      await client.trusthub.v1
        .trustProducts(tpSid)
        .trustProductsEntityAssignments.create({ objectSid: state.a2p_profile_enduser_sid! })
      state.a2p_profile_attached = true
      await mergeProvisioningState(orgId, { a2p_profile_attached: true })
    }

    // 2.4 — Attach the Secondary Customer Profile to the TrustProduct
    if (!state.customer_profile_attached_to_trust_product) {
      await client.trusthub.v1
        .trustProducts(tpSid)
        .trustProductsEntityAssignments.create({ objectSid: secondaryProfileSid })
      state.customer_profile_attached_to_trust_product = true
      await mergeProvisioningState(orgId, { customer_profile_attached_to_trust_product: true })
    }

    // 2.5 — Evaluate the TrustProduct
    const evaluation = await client.trusthub.v1
      .trustProducts(tpSid)
      .trustProductsEvaluations.create({ policySid: TRUST_PRODUCT_POLICY_SID })
    const evalStatus = evaluation.status === "compliant" ? "compliant" : "noncompliant"
    await mergeProvisioningState(orgId, { trust_product_evaluation_status: evalStatus })

    if (evalStatus !== "compliant") {
      const summary = summarizeEvaluationFailures(evaluation.results)
      await upsertOrgTwilio(orgId, { a2p_status: "failed", provisioning_error: summary })
      return { ok: false, evaluation: "noncompliant", error: summary }
    }

    // 2.6 — Submit the TrustProduct (move to review)
    if (!state.trust_product_submitted) {
      await client.trusthub.v1.trustProducts(tpSid).update({ status: "pending-review" })
      state.trust_product_submitted = true
      await mergeProvisioningState(orgId, { trust_product_submitted: true })
    }

    // Step 3 — BrandRegistration
    if (!row.brand_sid && !state.brand_registration_sid) {
      // Rate-limit safety: Brand/Campaign registration is capped at ≤ 1 req/sec.
      await new Promise((r) => setTimeout(r, 1100))
      const mock = process.env.LISTHIT_TWILIO_BRAND_MOCK === "true"
      const brand = await client.messaging.v1.brandRegistrations.create({
        customerProfileBundleSid: secondaryProfileSid,
        a2PProfileBundleSid: tpSid,
        brandType: BRAND_TYPE_STANDARD,
        ...(mock ? { mock: true } : {}),
      })
      state.brand_registration_sid = brand.sid
      state.brand_status = brand.status
      await mergeProvisioningState(
        orgId,
        { brand_registration_sid: brand.sid, brand_status: brand.status },
        { brand_sid: brand.sid, brand_status: brand.status },
      )

      if (brand.status === "FAILED") {
        const reason = str(brand.failureReason) || "Brand registration failed."
        await upsertOrgTwilio(orgId, { a2p_status: "failed", provisioning_error: reason })
        return {
          ok: false,
          trustProductSid: tpSid,
          brandSid: brand.sid,
          brandStatus: brand.status,
          evaluation: "compliant",
          error: reason,
        }
      }

      return {
        ok: true,
        trustProductSid: tpSid,
        brandSid: brand.sid,
        brandStatus: brand.status,
        evaluation: "compliant",
      }
    }

    // Brand already filed — self-healing resume returns the persisted SIDs.
    return {
      ok: true,
      trustProductSid: tpSid,
      brandSid: row.brand_sid ?? state.brand_registration_sid,
      brandStatus: row.brand_status ?? state.brand_status,
      evaluation: "compliant",
    }
  } catch (err) {
    const message = errorMessage(err)
    console.error("[provisionBrand] failed", { orgId, err })
    await upsertOrgTwilio(orgId, { a2p_status: "failed", provisioning_error: message })
    return { ok: false, error: message }
  }
}
