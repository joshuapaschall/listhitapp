export type SmsProviderName = "telnyx" | "twilio"

// Row shape the decision reads (subset of OrgTwilio). Kept local so this file has no deps.
export interface ProviderRoutingRow {
  sms_provider?: string | null
  brand_status?: string | null
  messaging_service_sid?: string | null
  campaign_sid?: string | null
  phone_number?: string | null
}

export function parseTelnyxPinnedOrgIds(raw: string | undefined | null): Set<string> {
  return new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean))
}

export function isOrgTelnyxPinned(orgId: string, pinned: Set<string>): boolean {
  return pinned.has(orgId)
}

// The Twilio SMS rail is only "live" when the brand is approved, a Messaging Service and
// Campaign exist, and a sender number is attached.
export function isTwilioSmsLive(row: ProviderRoutingRow | null | undefined): boolean {
  if (!row) return false
  return (
    row.brand_status === "APPROVED" &&
    !!row.messaging_service_sid &&
    !!row.campaign_sid &&
    !!row.phone_number
  )
}

// First match wins: (1) owner/legacy pin → telnyx; (2) explicit opt-in AND live → twilio;
// (3) safe default → telnyx.
export function resolveProviderName(
  orgId: string,
  row: ProviderRoutingRow | null | undefined,
  pinned: Set<string>,
): SmsProviderName {
  if (isOrgTelnyxPinned(orgId, pinned)) return "telnyx"
  if (row?.sms_provider === "twilio" && isTwilioSmsLive(row)) return "twilio"
  return "telnyx"
}

// Fails loudly in production if the owner pin is unset — invoked from the send path in T5.
export function assertTelnyxPinConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === "production" && parseTelnyxPinnedOrgIds(env.TELNYX_PINNED_ORG_IDS).size === 0) {
    throw new Error(
      "TELNYX_PINNED_ORG_IDS must be set in production so owner traffic is pinned to Telnyx.",
    )
  }
}
