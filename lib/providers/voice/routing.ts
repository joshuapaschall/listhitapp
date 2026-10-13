import { parseTelnyxPinnedOrgIds, isOrgTelnyxPinned } from "@/lib/providers/sms/routing"

// Same owner/tenant rule as SMS (see lib/providers/sms/routing.ts): the pinned
// owner org is the only Telnyx org; every other org is Twilio-only, and a tenant
// whose voice rail isn't live is "blocked" — never Telnyx. voice_provider is
// ignored for tenants.
export type VoiceProviderName = "telnyx" | "twilio" | "blocked"

export interface VoiceRoutingRow {
  voice_provider?: string | null
  subaccount_sid?: string | null
  phone_number?: string | null
  api_key_sid?: string | null
  twiml_app_sid?: string | null
  has_credentials?: boolean
}

// Voice rail is live when the org has its own subaccount credentials, a voice
// API key + TwiML App inside that subaccount, and a number. Voice has NO A2P
// dependency — brand/campaign are SMS-only compliance, so calling works as soon
// as the org has a number.
export function isTwilioVoiceLive(row: VoiceRoutingRow | null | undefined): boolean {
  if (!row) return false
  return (
    row.has_credentials === true &&
    !!row.subaccount_sid &&
    !!row.api_key_sid &&
    !!row.twiml_app_sid &&
    !!row.phone_number
  )
}

// Pinned owner → telnyx. Every other org → twilio when live, otherwise blocked.
export function resolveVoiceProviderName(
  orgId: string,
  row: VoiceRoutingRow | null | undefined,
  pinned: Set<string>,
): VoiceProviderName {
  if (isOrgTelnyxPinned(orgId, pinned)) return "telnyx"
  return isTwilioVoiceLive(row) ? "twilio" : "blocked"
}

export { parseTelnyxPinnedOrgIds }
