import { loadRoutingState } from "@/lib/providers/routing-state"
import { getTwilioClientForOrg } from "@/lib/twilio/org-client"
import { TelnyxSmsProvider } from "./telnyx-provider"
import { TwilioSmsProvider } from "./twilio-provider"
import {
  resolveProviderName,
  parseTelnyxPinnedOrgIds,
  assertTelnyxPinConfigured,
  isOrgTelnyxPinned,
  type SmsProviderName,
} from "./routing"
import type { SmsProvider } from "./types"

export type { SendSmsInput, SendSmsResult, SmsProvider, SmsProviderError } from "./types"
export { TelnyxSmsProvider } from "./telnyx-provider"
export { TwilioSmsProvider } from "./twilio-provider"

// Thrown when an org can't text: no org, or a tenant whose Twilio rail isn't
// live. Callers map it to 409 { code: "sms_not_ready" } — never to a Telnyx send.
export class SmsNotReadyError extends Error {
  readonly code = "sms_not_ready"
  readonly status = 409
  constructor(message = "Texting isn't set up for your account yet. Finish setup in Get started.") {
    super(message)
    this.name = "SmsNotReadyError"
  }
}

async function resolveName(orgId: string) {
  const state = await loadRoutingState(orgId)
  const pinned = parseTelnyxPinnedOrgIds(process.env.TELNYX_PINNED_ORG_IDS)
  return { state, name: resolveProviderName(orgId, state, pinned) }
}

// Composition root: the only impure place that reads env + DB and picks a provider.
// The pinned owner org always resolves to Telnyx. Every other org gets its own
// Twilio subaccount client when its rail is live, and SmsNotReadyError otherwise.
export async function resolveSmsProvider(orgId?: string | null): Promise<SmsProvider> {
  assertTelnyxPinConfigured()
  if (!orgId) throw new SmsNotReadyError()
  // Owner org: Telnyx, decided before any database read.
  if (isOrgTelnyxPinned(orgId, parseTelnyxPinnedOrgIds(process.env.TELNYX_PINNED_ORG_IDS))) {
    return new TelnyxSmsProvider()
  }

  const { state, name } = await resolveName(orgId)
  if (name === "telnyx") return new TelnyxSmsProvider()
  if (name === "twilio" && state?.messaging_service_sid) {
    return new TwilioSmsProvider({
      client: await getTwilioClientForOrg(orgId),
      messagingServiceSid: state.messaging_service_sid,
    })
  }
  throw new SmsNotReadyError()
}

// Non-throwing readiness check for pre-queue gates and status endpoints.
export async function getSmsReadiness(orgId?: string | null): Promise<SmsProviderName> {
  if (!orgId) return "blocked"
  if (isOrgTelnyxPinned(orgId, parseTelnyxPinnedOrgIds(process.env.TELNYX_PINNED_ORG_IDS))) return "telnyx"
  try {
    return (await resolveName(orgId)).name
  } catch (err) {
    console.error("[sms-readiness] routing lookup failed", { orgId }, err)
    return "blocked"
  }
}
