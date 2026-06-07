import { TelnyxSmsProvider } from "./telnyx-provider"
import type { SmsProvider } from "./types"

export type { SendSmsInput, SendSmsResult, SmsProvider, SmsProviderError } from "./types"
export { TelnyxSmsProvider } from "./telnyx-provider"

// Telnyx is the only implementation today. `orgId` is accepted for forward
// compatibility but ignored — every org resolves to Telnyx.
export async function resolveSmsProvider(_orgId?: string | null): Promise<SmsProvider> {
  return new TelnyxSmsProvider()
}
