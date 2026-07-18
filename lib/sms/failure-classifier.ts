export type SmsFailureKind = "bad_recipient" | "bad_sender" | "transient" | "other"

export interface SmsFailureClassification {
  kind: SmsFailureKind
  reason: string            // short machine reason for suppression records
  senderNumber?: string     // E.164 pulled from a bad-sender error, if present
}

// Recipient is permanently unreachable (invalid, landline, unroutable).
const BAD_RECIPIENT = [
  /should be a single valid number/i,
  /not a valid (phone )?number/i,
  /destination is not mobile/i,
  /mobile-only setting is active/i,
  /invalid.*(destination|to number|phone)/i,
  /unallocated|unknown subscriber|no route/i,
]

// The sending number itself is bad (not owned / not associated with the account).
const BAD_SENDER = [
  /is not associated with the account/i,
  /from.*number.*not.*(found|owned|valid)/i,
  /sender.*not.*authorized/i,
]

const TRANSIENT = [/timeout/i, /network error/i, /rate limit/i, /temporarily/i, /try again/i]

export function classifySmsFailure(errorText: string | null | undefined): SmsFailureClassification {
  const text = errorText || ""
  if (BAD_SENDER.some((r) => r.test(text))) {
    const m = text.match(/\+?\d[\d\s().-]{9,}\d/)
    const senderNumber = m ? "+" + m[0].replace(/[^\d]/g, "").replace(/^1?/, "1") : undefined
    return { kind: "bad_sender", reason: "sender_not_on_account", senderNumber }
  }
  if (BAD_RECIPIENT.some((r) => r.test(text))) {
    const reason = /not mobile|mobile-only/i.test(text) ? "landline" : "invalid_number"
    return { kind: "bad_recipient", reason }
  }
  if (TRANSIENT.some((r) => r.test(text))) return { kind: "transient", reason: "transient" }
  return { kind: "other", reason: "other" }
}
