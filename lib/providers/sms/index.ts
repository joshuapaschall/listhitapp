import { getOrgTwilio } from "@/lib/org-twilio/service"
import { TelnyxSmsProvider } from "./telnyx-provider"
import { TwilioSmsProvider } from "./twilio-provider"
import {
  resolveProviderName,
  parseTelnyxPinnedOrgIds,
  assertTelnyxPinConfigured,
} from "./routing"
import type { SmsProvider } from "./types"

export type { SendSmsInput, SendSmsResult, SmsProvider, SmsProviderError } from "./types"
export { TelnyxSmsProvider } from "./telnyx-provider"
export { TwilioSmsProvider } from "./twilio-provider"

// Composition root: the only impure place that reads env + DB and picks a provider.
// GWH (and any pinned org) always resolves to Telnyx; a "twilio" result is only
// possible when the org opted in AND its rail is live (brand APPROVED + MG +
// campaign + number), which guarantees `messaging_service_sid` is present.
export async function resolveSmsProvider(orgId?: string | null): Promise<SmsProvider> {
  assertTelnyxPinConfigured()
  if (!orgId) return new TelnyxSmsProvider()

  const row = await getOrgTwilio(orgId)
  const pinned = parseTelnyxPinnedOrgIds(process.env.TELNYX_PINNED_ORG_IDS)
  const name = resolveProviderName(orgId, row, pinned)

  if (name === "twilio" && row?.messaging_service_sid) {
    return new TwilioSmsProvider({ messagingServiceSid: row.messaging_service_sid })
  }
  return new TelnyxSmsProvider()
}
