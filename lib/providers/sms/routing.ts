// THE OWNER/TENANT RULE
//   ListHit has exactly two kinds of org:
//   1. The owner org (GWH), pinned through TELNYX_PINNED_ORG_IDS. It is the ONLY
//      org that ever uses Telnyx, for SMS and voice.
//   2. Every other org. These run on Twilio only, each in its own subaccount. A
//      tenant that isn't fully live on Twilio is "blocked": it gets a clear "not
//      set up yet" error and NEVER falls back to Telnyx, the parent Twilio
//      account, DEFAULT_OUTBOUND_DID, or anything else.
//   The org_twilio.sms_provider column is ignored for tenants — readiness alone
//   decides.
export type SmsProviderName = "telnyx" | "twilio" | "blocked"

// Row shape the decision reads (org_twilio + presence of org_twilio_credentials).
// Kept local so this file has no deps.
export interface ProviderRoutingRow {
  sms_provider?: string | null
  subaccount_sid?: string | null
  brand_status?: string | null
  campaign_status?: string | null
  messaging_service_sid?: string | null
  campaign_sid?: string | null
  phone_number?: string | null
  has_credentials?: boolean
}

export function parseTelnyxPinnedOrgIds(raw: string | undefined | null): Set<string> {
  return new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean))
}

export function isOrgTelnyxPinned(orgId: string, pinned: Set<string>): boolean {
  return pinned.has(orgId)
}

// The Twilio SMS rail is only "live" when the org has its own subaccount
// credentials, an APPROVED brand, a VERIFIED campaign, a Messaging Service, and a
// sender number.
export function isTwilioSmsLive(row: ProviderRoutingRow | null | undefined): boolean {
  if (!row) return false
  return (
    row.has_credentials === true &&
    !!row.subaccount_sid &&
    row.brand_status === "APPROVED" &&
    row.campaign_status === "VERIFIED" &&
    !!row.messaging_service_sid &&
    !!row.campaign_sid &&
    !!row.phone_number
  )
}

// Pinned owner → telnyx. Every other org → twilio when live, otherwise blocked.
export function resolveProviderName(
  orgId: string,
  row: ProviderRoutingRow | null | undefined,
  pinned: Set<string>,
): SmsProviderName {
  if (isOrgTelnyxPinned(orgId, pinned)) return "telnyx"
  return isTwilioSmsLive(row) ? "twilio" : "blocked"
}

// Env-reading conveniences. Every other org is Twilio-only, so "pinned" is the
// single switch that says "this request belongs to the Telnyx owner org".
export function getPinnedTelnyxOrgIds(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return parseTelnyxPinnedOrgIds(env.TELNYX_PINNED_ORG_IDS)
}

export function isOrgTelnyxPinnedEnv(
  orgId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!orgId) return false
  return isOrgTelnyxPinned(orgId, getPinnedTelnyxOrgIds(env))
}

let warnedPrimaryPin = false

// The one org that runs on Telnyx. Only meaningful when exactly one id is pinned:
// with zero we have no owner org, with two we cannot say which one a Telnyx-only
// webhook or sync belongs to, so both cases resolve to null and callers fail closed.
export function getPrimaryPinnedTelnyxOrgId(env: NodeJS.ProcessEnv = process.env): string | null {
  const pinned = getPinnedTelnyxOrgIds(env)
  if (pinned.size === 1) return [...pinned][0]

  if (!warnedPrimaryPin) {
    warnedPrimaryPin = true
    console.error(
      `[sms-routing] TELNYX_PINNED_ORG_IDS must contain exactly one org id (found ${pinned.size}). ` +
        "Telnyx-only paths (inbound without a known DID, voice-number sync, the public GWH " +
        "endpoints) cannot resolve an owner org and will fail closed until this is fixed.",
    )
  }
  return null
}

// Fails loudly in production if the owner pin is unset — invoked from the send path in T5.
export function assertTelnyxPinConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === "production" && parseTelnyxPinnedOrgIds(env.TELNYX_PINNED_ORG_IDS).size === 0) {
    throw new Error(
      "TELNYX_PINNED_ORG_IDS must be set in production so owner traffic is pinned to Telnyx.",
    )
  }
}
