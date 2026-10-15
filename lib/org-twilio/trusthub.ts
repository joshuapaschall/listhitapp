import "server-only"

import type { Twilio } from "twilio"

import { getListHitPrimaryProfileSid } from "@/lib/providers/twilio/client"
import { mergeProvisioningState } from "@/lib/org-twilio/service"
import type { ProvisioningState } from "@/lib/org-twilio/types"
import {
  SECONDARY_CUSTOMER_PROFILE_POLICY_SID,
  SOLE_PROPRIETOR_TRUST_PRODUCT_POLICY_SID,
  STARTER_CUSTOMER_PROFILE_POLICY_SID,
  TRUST_PRODUCT_POLICY_SID,
  buildA2pMessagingProfileAttributes,
  buildAddressParams,
  buildAuthorizedRepAttributes,
  buildBusinessInformationAttributes,
  buildSoleProprietorAddressParams,
  buildSoleProprietorAttributes,
  buildStarterProfileAttributes,
  soleProprietorBrandName,
  type ProvisioningInputs,
  type SoleProprietorInputs,
} from "@/lib/org-twilio/twilio-attributes"

// Trust Hub drafts for both ISV paths, always in the org's own subaccount:
//   Standard:  Secondary Customer Profile → A2P TrustProduct
//   Sole prop: Starter Customer Profile   → Sole Proprietor TrustProduct
// Twilio's ISV order: build the profile → evaluate → submit it (pending-review)
// → only then build, attach, evaluate and submit the TrustProduct, whose policy
// requires the attached profile to be at least in review. Trust Hub building and
// submission are free, so both happen before the spend gate. Every created SID
// is persisted immediately so a crash resumes instead of duplicating.
//
// `sync` re-pushes the customer's data onto EndUsers/addresses that already
// exist. Updating a submitted bundle sends it back to draft, so the engine only
// syncs before the first submission and on an explicit resubmit — and a synced
// bundle is always submitted again afterwards.

export type DraftResult = { compliant: true } | { compliant: false; results: unknown }

export type DraftOptions = {
  sync: boolean
  // Last known Twilio statuses (org_twilio columns), used to skip a submit that already happened.
  profileStatus?: string | null
  trustProductStatus?: string | null
}

// Statuses at or past review: submitting again would be a no-op at best.
const IN_OR_PAST_REVIEW = new Set(["pending-review", "in-review", "twilio-approved"])

export function isInOrPastReview(status: string | null | undefined): boolean {
  return !!status && IN_OR_PAST_REVIEW.has(status)
}

// LISTHIT-owned notification email for Trust Hub status updates (never the tenant's).
function notifyEmail(): string {
  return process.env.LISTHIT_TWILIO_NOTIFY_EMAIL || "compliance@listhit.io"
}

// Shared-secret Trust Hub status-callback URL. Never a cron secret.
function statusCallbackUrl(): string | undefined {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  const token = process.env.LISTHIT_TWILIO_STATUS_CALLBACK_TOKEN || ""
  if (!base || !token) return undefined
  return `${base}/api/webhooks/twilio-trusthub?token=${encodeURIComponent(token)}`
}

async function persist(orgId: string, state: ProvisioningState, partial: Partial<ProvisioningState>, patch?: Record<string, unknown>) {
  Object.assign(state, partial)
  await mergeProvisioningState(orgId, partial, patch as any)
}

async function attachToProfile(client: Twilio, profileSid: string, objectSid: string) {
  await client.trusthub.v1.customerProfiles(profileSid).customerProfilesEntityAssignments.create({ objectSid })
}

async function attachToTrustProduct(client: Twilio, trustProductSid: string, objectSid: string) {
  await client.trusthub.v1.trustProducts(trustProductSid).trustProductsEntityAssignments.create({ objectSid })
}

async function evaluateProfile(client: Twilio, profileSid: string, policySid: string) {
  return client.trusthub.v1.customerProfiles(profileSid).customerProfilesEvaluations.create({ policySid })
}

async function evaluateTrustProduct(client: Twilio, trustProductSid: string, policySid: string) {
  return client.trusthub.v1.trustProducts(trustProductSid).trustProductsEvaluations.create({ policySid })
}

async function markTrustHubSubmitted(orgId: string, state: ProvisioningState) {
  await persist(orgId, state, { trust_hub_submitted_at: new Date().toISOString() })
}

// ---- Standard ----------------------------------------------------------------

export async function ensureStandardDrafts(
  client: Twilio,
  orgId: string,
  state: ProvisioningState,
  inputs: ProvisioningInputs,
  opts: DraftOptions,
): Promise<DraftResult> {
  const legalName = inputs.legalBusinessName
  const callback = statusCallbackUrl()
  let profileStatus = opts.profileStatus ?? null
  let tpStatus = opts.trustProductStatus ?? null

  if (!state.secondary_profile_sid) {
    const cp = await client.trusthub.v1.customerProfiles.create({
      friendlyName: `${legalName} — Secondary Customer Profile (org ${orgId})`,
      email: notifyEmail(),
      policySid: SECONDARY_CUSTOMER_PROFILE_POLICY_SID,
      ...(callback ? { statusCallback: callback } : {}),
    })
    await persist(orgId, state, { secondary_profile_sid: cp.sid }, { secondary_profile_sid: cp.sid, customer_profile_status: cp.status })
    profileStatus = cp.status
  }
  const profileSid = state.secondary_profile_sid!

  if (!state.business_info_enduser_sid) {
    const eu = await client.trusthub.v1.endUsers.create({
      friendlyName: `${legalName} — Business Information`,
      type: "customer_profile_business_information",
      attributes: buildBusinessInformationAttributes(inputs),
    })
    await persist(orgId, state, { business_info_enduser_sid: eu.sid })
  } else if (opts.sync) {
    await client.trusthub.v1.endUsers(state.business_info_enduser_sid).update({ attributes: buildBusinessInformationAttributes(inputs) })
  }
  if (!state.business_info_attached) {
    await attachToProfile(client, profileSid, state.business_info_enduser_sid!)
    await persist(orgId, state, { business_info_attached: true })
  }

  if (!state.authorized_rep_enduser_sid) {
    const rep = await client.trusthub.v1.endUsers.create({
      friendlyName: `${legalName} — Authorized Rep 1`,
      type: "authorized_representative_1",
      attributes: buildAuthorizedRepAttributes(inputs),
    })
    await persist(orgId, state, { authorized_rep_enduser_sid: rep.sid })
  } else if (opts.sync) {
    await client.trusthub.v1.endUsers(state.authorized_rep_enduser_sid).update({ attributes: buildAuthorizedRepAttributes(inputs) })
  }
  if (!state.authorized_rep_attached) {
    await attachToProfile(client, profileSid, state.authorized_rep_enduser_sid!)
    await persist(orgId, state, { authorized_rep_attached: true })
  }

  if (!state.address_sid) {
    const addr = await client.addresses.create({ friendlyName: `${legalName} — Mailing Address`, ...buildAddressParams(inputs) })
    await persist(orgId, state, { address_sid: addr.sid })
  } else if (opts.sync) {
    await client.addresses(state.address_sid).update({ ...buildAddressParams(inputs) })
  }
  if (!state.supporting_document_sid) {
    const doc = await client.trusthub.v1.supportingDocuments.create({
      friendlyName: `${legalName} — Address Document`,
      type: "customer_profile_address",
      attributes: { address_sids: state.address_sid },
    })
    await persist(orgId, state, { supporting_document_sid: doc.sid })
  }
  if (!state.supporting_document_attached) {
    await attachToProfile(client, profileSid, state.supporting_document_sid!)
    await persist(orgId, state, { supporting_document_attached: true })
  }
  if (!state.primary_profile_assigned) {
    await attachToProfile(client, profileSid, getListHitPrimaryProfileSid())
    await persist(orgId, state, { primary_profile_assigned: true })
  }

  const profileEval = await evaluateProfile(client, profileSid, SECONDARY_CUSTOMER_PROFILE_POLICY_SID)
  await persist(orgId, state, {
    last_evaluation_status: profileEval.status === "compliant" ? "compliant" : "noncompliant",
    last_evaluation_at: new Date().toISOString(),
  })
  if (profileEval.status !== "compliant") return { compliant: false, results: profileEval.results }

  // Submit the profile now: the TrustProduct evaluation requires it in review.
  // A synced profile went back to draft on Twilio's side, so it is re-submitted.
  if (opts.sync || !isInOrPastReview(profileStatus)) {
    const submitted = await client.trusthub.v1.customerProfiles(profileSid).update({ status: "pending-review" })
    profileStatus = submitted.status
    await persist(orgId, state, { submitted: true, submitted_at: new Date().toISOString() }, { customer_profile_status: submitted.status })
  }

  if (!state.trust_product_sid) {
    const tp = await client.trusthub.v1.trustProducts.create({
      friendlyName: `${legalName} — A2P Trust Product (org ${orgId})`,
      email: notifyEmail(),
      policySid: TRUST_PRODUCT_POLICY_SID,
      ...(callback ? { statusCallback: callback } : {}),
    })
    await persist(orgId, state, { trust_product_sid: tp.sid }, { trust_product_sid: tp.sid, trust_product_status: tp.status })
    tpStatus = tp.status
  }
  const tpSid = state.trust_product_sid!

  if (!state.a2p_profile_enduser_sid) {
    const eu = await client.trusthub.v1.endUsers.create({
      friendlyName: `${legalName} — A2P Messaging Profile`,
      type: "us_a2p_messaging_profile_information",
      attributes: buildA2pMessagingProfileAttributes(inputs),
    })
    await persist(orgId, state, { a2p_profile_enduser_sid: eu.sid })
  } else if (opts.sync) {
    await client.trusthub.v1.endUsers(state.a2p_profile_enduser_sid).update({ attributes: buildA2pMessagingProfileAttributes(inputs) })
  }
  if (!state.a2p_profile_attached) {
    await attachToTrustProduct(client, tpSid, state.a2p_profile_enduser_sid!)
    await persist(orgId, state, { a2p_profile_attached: true })
  }
  if (!state.customer_profile_attached_to_trust_product) {
    await attachToTrustProduct(client, tpSid, profileSid)
    await persist(orgId, state, { customer_profile_attached_to_trust_product: true })
  }

  const tpEval = await evaluateTrustProduct(client, tpSid, TRUST_PRODUCT_POLICY_SID)
  await persist(orgId, state, { trust_product_evaluation_status: tpEval.status === "compliant" ? "compliant" : "noncompliant" })
  if (tpEval.status !== "compliant") return { compliant: false, results: tpEval.results }

  if (opts.sync || !isInOrPastReview(tpStatus)) {
    const submitted = await client.trusthub.v1.trustProducts(tpSid).update({ status: "pending-review" })
    await persist(orgId, state, { trust_product_submitted: true, trust_product_status: submitted.status }, { trust_product_status: submitted.status })
  }
  await markTrustHubSubmitted(orgId, state)
  return { compliant: true }
}

// ---- Sole proprietor ---------------------------------------------------------

export async function ensureSoleProprietorDrafts(
  client: Twilio,
  orgId: string,
  state: ProvisioningState,
  inputs: SoleProprietorInputs,
  opts: DraftOptions,
): Promise<DraftResult> {
  const name = soleProprietorBrandName(inputs)
  const callback = statusCallbackUrl()
  let profileStatus = opts.profileStatus ?? null
  let tpStatus = opts.trustProductStatus ?? null

  // The starter profile lives in secondary_profile_sid so the Trust Hub webhook
  // and brand registration find it the same way for both paths.
  if (!state.secondary_profile_sid) {
    const cp = await client.trusthub.v1.customerProfiles.create({
      friendlyName: `${name} — Starter Customer Profile (org ${orgId})`,
      email: notifyEmail(),
      policySid: STARTER_CUSTOMER_PROFILE_POLICY_SID,
      ...(callback ? { statusCallback: callback } : {}),
    })
    await persist(orgId, state, { secondary_profile_sid: cp.sid }, { secondary_profile_sid: cp.sid, customer_profile_status: cp.status })
    profileStatus = cp.status
  }
  const profileSid = state.secondary_profile_sid!

  if (!state.starter_profile_enduser_sid) {
    const eu = await client.trusthub.v1.endUsers.create({
      friendlyName: `${name} — Starter Profile Information`,
      type: "starter_customer_profile_information",
      attributes: buildStarterProfileAttributes(inputs),
    })
    await persist(orgId, state, { starter_profile_enduser_sid: eu.sid })
  } else if (opts.sync) {
    await client.trusthub.v1.endUsers(state.starter_profile_enduser_sid).update({ attributes: buildStarterProfileAttributes(inputs) })
  }
  if (!state.starter_profile_enduser_attached) {
    await attachToProfile(client, profileSid, state.starter_profile_enduser_sid!)
    await persist(orgId, state, { starter_profile_enduser_attached: true })
  }

  if (!state.address_sid) {
    const addr = await client.addresses.create({ friendlyName: `${name} — Mailing Address`, ...buildSoleProprietorAddressParams(inputs) })
    await persist(orgId, state, { address_sid: addr.sid })
  } else if (opts.sync) {
    await client.addresses(state.address_sid).update({ ...buildSoleProprietorAddressParams(inputs) })
  }
  if (!state.supporting_document_sid) {
    const doc = await client.trusthub.v1.supportingDocuments.create({
      friendlyName: `${name} — Address Document`,
      type: "customer_profile_address",
      attributes: { address_sids: state.address_sid },
    })
    await persist(orgId, state, { supporting_document_sid: doc.sid })
  }
  if (!state.supporting_document_attached) {
    await attachToProfile(client, profileSid, state.supporting_document_sid!)
    await persist(orgId, state, { supporting_document_attached: true })
  }
  if (!state.primary_profile_assigned) {
    await attachToProfile(client, profileSid, getListHitPrimaryProfileSid())
    await persist(orgId, state, { primary_profile_assigned: true })
  }

  const profileEval = await evaluateProfile(client, profileSid, STARTER_CUSTOMER_PROFILE_POLICY_SID)
  await persist(orgId, state, {
    last_evaluation_status: profileEval.status === "compliant" ? "compliant" : "noncompliant",
    last_evaluation_at: new Date().toISOString(),
  })
  if (profileEval.status !== "compliant") return { compliant: false, results: profileEval.results }

  // Submit the profile now: the TrustProduct evaluation requires it in review.
  // A synced profile went back to draft on Twilio's side, so it is re-submitted.
  if (opts.sync || !isInOrPastReview(profileStatus)) {
    const submitted = await client.trusthub.v1.customerProfiles(profileSid).update({ status: "pending-review" })
    profileStatus = submitted.status
    await persist(orgId, state, { submitted: true, submitted_at: new Date().toISOString() }, { customer_profile_status: submitted.status })
  }

  if (!state.trust_product_sid) {
    const tp = await client.trusthub.v1.trustProducts.create({
      friendlyName: `${name} — Sole Proprietor Trust Product (org ${orgId})`,
      email: notifyEmail(),
      policySid: SOLE_PROPRIETOR_TRUST_PRODUCT_POLICY_SID,
      ...(callback ? { statusCallback: callback } : {}),
    })
    await persist(orgId, state, { trust_product_sid: tp.sid }, { trust_product_sid: tp.sid, trust_product_status: tp.status })
    tpStatus = tp.status
  }
  const tpSid = state.trust_product_sid!

  if (!state.sole_prop_enduser_sid) {
    const eu = await client.trusthub.v1.endUsers.create({
      friendlyName: `${name} — Sole Proprietor Information`,
      type: "sole_proprietor_information",
      attributes: buildSoleProprietorAttributes(inputs),
    })
    await persist(orgId, state, { sole_prop_enduser_sid: eu.sid })
  } else if (opts.sync) {
    await client.trusthub.v1.endUsers(state.sole_prop_enduser_sid).update({ attributes: buildSoleProprietorAttributes(inputs) })
  }
  if (!state.sole_prop_enduser_attached) {
    await attachToTrustProduct(client, tpSid, state.sole_prop_enduser_sid!)
    await persist(orgId, state, { sole_prop_enduser_attached: true })
  }
  if (!state.customer_profile_attached_to_trust_product) {
    await attachToTrustProduct(client, tpSid, profileSid)
    await persist(orgId, state, { customer_profile_attached_to_trust_product: true })
  }

  const tpEval = await evaluateTrustProduct(client, tpSid, SOLE_PROPRIETOR_TRUST_PRODUCT_POLICY_SID)
  await persist(orgId, state, { trust_product_evaluation_status: tpEval.status === "compliant" ? "compliant" : "noncompliant" })
  if (tpEval.status !== "compliant") return { compliant: false, results: tpEval.results }

  if (opts.sync || !isInOrPastReview(tpStatus)) {
    const submitted = await client.trusthub.v1.trustProducts(tpSid).update({ status: "pending-review" })
    await persist(orgId, state, { trust_product_submitted: true, trust_product_status: submitted.status }, { trust_product_status: submitted.status })
  }
  await markTrustHubSubmitted(orgId, state)
  return { compliant: true }
}

// ---- Submit safety net (both paths) ------------------------------------------

// The drafts step submits both objects as soon as each evaluates compliant.
// This only runs when trust_hub_submitted_at is still unset, and skips each
// object already in or past review, so calling it twice is harmless.
export async function submitTrustHub(
  client: Twilio,
  orgId: string,
  state: ProvisioningState,
  statuses: { profileStatus?: string | null; trustProductStatus?: string | null } = {},
) {
  let profileStatus = statuses.profileStatus ?? null
  let trustProductStatus = statuses.trustProductStatus ?? state.trust_product_status ?? null
  if (!isInOrPastReview(profileStatus)) {
    const profile = await client.trusthub.v1.customerProfiles(state.secondary_profile_sid!).update({ status: "pending-review" })
    profileStatus = profile.status
    await persist(orgId, state, { submitted: true, submitted_at: new Date().toISOString() }, { customer_profile_status: profile.status })
  }
  if (!isInOrPastReview(trustProductStatus)) {
    const trustProduct = await client.trusthub.v1.trustProducts(state.trust_product_sid!).update({ status: "pending-review" })
    trustProductStatus = trustProduct.status
    await persist(
      orgId,
      state,
      { trust_product_submitted: true, trust_product_status: trustProduct.status },
      { trust_product_status: trustProduct.status },
    )
  }
  await markTrustHubSubmitted(orgId, state)
  return { profileStatus, trustProductStatus }
}
