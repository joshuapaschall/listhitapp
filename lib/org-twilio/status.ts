// Customer-facing registration status, built from the org_twilio row. Pure: no
// I/O. Never exposes SIDs, tokens or raw Twilio errors — only stage, step
// states, plain-English issues and dates.

import type { CustomerIssue } from "@/lib/org-twilio/issues"
import type { OrgTwilio, OrgTwilioBrandType, OrgTwilioSetupStage } from "@/lib/org-twilio/types"

export type StepKey = "business" | "brand" | "verify_mobile" | "campaign" | "number"
export type StepState = "done" | "current" | "waiting" | "issue"

export type RegistrationStatus = {
  stage: OrgTwilioSetupStage
  brandType: OrgTwilioBrandType | null
  phoneNumber: string | null
  submittedAt: string | null
  liveAt: string | null
  steps: Array<{ key: StepKey; label: string; state: StepState; at?: string; note?: string }>
  issues: CustomerIssue[]
  canResubmit: boolean
  canResendOtp: boolean
  reviewCopy: "Usually a few business days"
}

const BUSINESS_FIELDS = new Set(["legal_name", "ein", "business_type", "address", "rep", "website"])
const CAMPAIGN_FIELDS = new Set(["samples", "message_flow"])

function asIssues(value: unknown): CustomerIssue[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (i): i is CustomerIssue =>
      !!i && typeof i === "object" && typeof (i as CustomerIssue).message === "string" && typeof (i as CustomerIssue).field === "string",
  ).map((i) => ({ field: i.field, message: i.message, fixable: Boolean(i.fixable), ...(i.code ? { code: i.code } : {}) }))
}

function verified(identity: string | null | undefined) {
  return identity === "VERIFIED" || identity === "VETTED_VERIFIED"
}

export function buildRegistrationStatus(row: OrgTwilio | null): RegistrationStatus {
  const stage: OrgTwilioSetupStage = (row?.setup_stage as OrgTwilioSetupStage) ?? "not_started"
  const brandType = (row?.brand_type as OrgTwilioBrandType | null) ?? null
  const issues = asIssues(row?.customer_issues)
  const hasIssues = stage === "action_required" || stage === "rejected"
  const businessIssue = hasIssues && issues.some((i) => BUSINESS_FIELDS.has(i.field))
  const campaignIssue = hasIssues && issues.some((i) => CAMPAIGN_FIELDS.has(i.field))
  const state = row?.provisioning_state ?? {}

  const brandStatus = row?.brand_status ?? null
  const campaignStatus = row?.campaign_status ?? null
  const submitted = Boolean(state.trust_hub_submitted_at)

  const steps: RegistrationStatus["steps"] = []

  steps.push({
    key: "business",
    label: "Business details",
    state: businessIssue ? "issue" : submitted ? "done" : row?.submitted_at ? "current" : "waiting",
    ...(state.trust_hub_submitted_at ? { at: state.trust_hub_submitted_at } : {}),
  })

  steps.push({
    key: "brand",
    label: "Business registration",
    state:
      brandStatus === "FAILED" || brandStatus === "SUSPENDED"
        ? "issue"
        : brandStatus === "APPROVED"
          ? "done"
          : row?.brand_sid
            ? "current"
            : "waiting",
  })

  if (brandType === "SOLE_PROPRIETOR") {
    steps.push({
      key: "verify_mobile",
      label: "Confirm your mobile number",
      state: verified(row?.brand_identity_status) ? "done" : stage === "verify_mobile" ? "current" : "waiting",
      ...(stage === "verify_mobile" ? { note: "Reply YES to the text from +1 915-278-2000 within 24 hours." } : {}),
    })
  }

  steps.push({
    key: "campaign",
    label: "Texting program review",
    state:
      campaignStatus === "FAILED" || campaignIssue
        ? "issue"
        : campaignStatus === "VERIFIED"
          ? "done"
          : row?.campaign_sid
            ? "current"
            : "waiting",
    ...(row?.live_at ? { at: row.live_at } : {}),
  })

  steps.push({
    key: "number",
    label: "Phone number",
    state: row?.phone_number ? "done" : "waiting",
    ...(row?.phone_number ? { note: "Calls work now; texting turns on when approved." } : {}),
  })

  return {
    stage,
    brandType,
    phoneNumber: row?.phone_number ?? null,
    submittedAt: row?.submitted_at ?? null,
    liveAt: row?.live_at ?? null,
    steps,
    issues,
    canResubmit: stage === "action_required" && issues.some((i) => i.fixable),
    canResendOtp: stage === "verify_mobile",
    reviewCopy: "Usually a few business days",
  }
}
