// Turns Twilio registration failures into issues a customer can act on. Pure —
// no I/O. Messages are written to the customer in plain English: no carrier or
// Twilio jargon, and Twilio's own reason is kept when it helps them fix it.

import { summarizeEvaluationFailures } from "@/lib/org-twilio/twilio-attributes"

export type CustomerIssueField =
  | "legal_name"
  | "ein"
  | "business_type"
  | "address"
  | "rep"
  | "website"
  | "samples"
  | "message_flow"
  | "other"

export type CustomerIssue = {
  field: CustomerIssueField
  message: string
  fixable: boolean
  code?: string
}

export const LEGAL_NAME_MISMATCH_MESSAGE =
  "Your legal business name must match your IRS EIN letter (CP 575) exactly, including LLC or Inc."
export const CARRIER_DECLINED_MESSAGE = "The carriers declined this registration. Contact support."
export const RESUBMISSIONS_EXHAUSTED_MESSAGE =
  "You've used all free resubmissions. Contact support to continue."

const CARRIER_DECLINED_CODES = new Set(["30882", "30883", "30884", "30885"])

// Strip Twilio's object names out of a reason before showing it to a customer.
function plain(reason: string): string {
  return reason
    .replace(/\b(TCR|TrustProduct|Trust Product|EndUser|End User|Customer Profile|Bundle)\b/gi, "registration")
    .replace(/\s+/g, " ")
    .trim()
}

function fieldFor(text: string): CustomerIssueField {
  const t = text.toLowerCase()
  if (/\b(ein|tax|registration number|business_registration)\b/.test(t)) return "ein"
  if (/business[_ ]type|legal structure/.test(t)) return "business_type"
  if (/address|street|city|postal|zip|region/.test(t)) return "address"
  if (/email|phone|representative|first[_ ]name|last[_ ]name|job|title/.test(t)) return "rep"
  if (/website|url|domain/.test(t)) return "website"
  if (/name/.test(t)) return "legal_name"
  return "other"
}

function friendlyEvaluationMessage(field: CustomerIssueField, reason: string): string {
  const prefix: Record<CustomerIssueField, string> = {
    legal_name: "Check your legal business name.",
    ein: "Check your EIN.",
    business_type: "Check your business type.",
    address: "Check your business address.",
    rep: "Check your authorized representative's details.",
    website: "Check your website.",
    samples: "Check your sample messages.",
    message_flow: "Check how buyers opt in.",
    other: "Check your business details.",
  }
  return `${prefix[field]} (${plain(reason)})`
}

// Collect each failing requirement's reason from a Trust Hub evaluation and map
// it to the field the customer should fix. Reuses summarizeEvaluationFailures'
// traversal so both stay in step.
export function issuesFromEvaluation(results: unknown): CustomerIssue[] {
  const summary = summarizeEvaluationFailures(results)
  const marker = "noncompliant:"
  const idx = summary.indexOf(marker)
  const reasons = idx >= 0 ? summary.slice(idx + marker.length).split(";").map((r) => r.trim()).filter(Boolean) : []
  if (!reasons.length) {
    return [{ field: "other", message: "Some of your business details need another look. Contact support if this keeps happening.", fixable: true }]
  }
  return reasons.map((reason) => {
    const field = fieldFor(reason)
    return { field, message: friendlyEvaluationMessage(field, reason), fixable: true }
  })
}

type TwilioErrorEntry = { error_code?: unknown; description?: unknown; code?: unknown; message?: unknown }

function issueFromError(entry: TwilioErrorEntry): CustomerIssue {
  const code = String(entry.error_code ?? entry.code ?? "").trim() || undefined
  const description = String(entry.description ?? entry.message ?? "").trim()
  const d = description.toLowerCase()

  if (code === "30893") {
    return {
      field: "samples",
      message: `Your sample messages need changes before the carriers will approve them.${description ? ` (${plain(description)})` : ""}`,
      fixable: true,
      code,
    }
  }
  if (code && CARRIER_DECLINED_CODES.has(code)) {
    return { field: "other", message: CARRIER_DECLINED_MESSAGE, fixable: false, code }
  }
  if (/too many brands|brand limit|maximum.*brands|exceeded.*brands/.test(d)) {
    return {
      field: "ein",
      message: "Your EIN is already used by the maximum number of registrations. Contact support.",
      fixable: false,
      code,
    }
  }
  if (/tax ?id|\bein\b|name mismatch|does not match|doesn't match|mismatch/.test(d)) {
    return { field: "legal_name", message: LEGAL_NAME_MISMATCH_MESSAGE, fixable: true, code }
  }
  if (/website|url|domain|privacy|terms/.test(d)) {
    return {
      field: "website",
      message: `Your website needs changes before the carriers will approve it.${description ? ` (${plain(description)})` : ""}`,
      fixable: true,
      code,
    }
  }
  return {
    field: "other",
    message: description ? `Your registration needs attention: ${plain(description)}` : "Your registration needs attention. Contact support.",
    fixable: true,
    code,
  }
}

export function issuesFromBrandErrors(errors: unknown): CustomerIssue[] {
  const list = Array.isArray(errors) ? (errors as TwilioErrorEntry[]) : []
  if (!list.length) {
    return [{ field: "other", message: "Your business registration was not approved. Check your details and resubmit.", fixable: true }]
  }
  return list.map(issueFromError)
}

export function issuesFromCampaignErrors(errors: unknown): CustomerIssue[] {
  const list = Array.isArray(errors) ? (errors as TwilioErrorEntry[]) : []
  if (!list.length) {
    return [{ field: "other", message: "Your texting program was not approved. Check your sample messages and resubmit.", fixable: true }]
  }
  return list.map(issueFromError)
}

// Stable fingerprint of an issue set, so a notification goes out once per new set.
export function issuesHash(issues: CustomerIssue[]): string {
  return issues
    .map((i) => `${i.field}|${i.code ?? ""}|${i.message}`)
    .sort()
    .join("\n")
}
