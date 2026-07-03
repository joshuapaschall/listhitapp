import { parseTelnyxPinnedOrgIds, isOrgTelnyxPinned } from "@/lib/providers/sms/routing"

export type VoiceProviderName = "telnyx" | "twilio"

export interface VoiceRoutingRow {
  voice_provider?: string | null
  phone_number?: string | null
}

// Voice rail is live when the org has a Twilio number. Voice has NO A2P
// dependency — brand/campaign are SMS-only compliance.
export function isTwilioVoiceLive(row: VoiceRoutingRow | null | undefined): boolean {
  return !!row?.phone_number
}

// First match wins: (1) owner/legacy pin → telnyx; (2) explicit opt-in AND live →
// twilio; (3) safe default → telnyx. Identical philosophy to the SMS resolver.
export function resolveVoiceProviderName(
  orgId: string,
  row: VoiceRoutingRow | null | undefined,
  pinned: Set<string>,
): VoiceProviderName {
  if (isOrgTelnyxPinned(orgId, pinned)) return "telnyx"
  if (row?.voice_provider === "twilio" && isTwilioVoiceLive(row)) return "twilio"
  return "telnyx"
}

export { parseTelnyxPinnedOrgIds }
