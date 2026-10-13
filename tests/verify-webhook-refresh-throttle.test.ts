// Forged webhooks must not hammer Twilio: a bad signature triggers at most one
// subaccount token refresh per org per 60 seconds.
import twilio from "twilio"

const SUB_SID = "AC" + "s".repeat(32)
const SUB_TOKEN = "subaccount-auth-token"
const ORG = "11111111-1111-4111-8111-111111111111"
const URL = "https://app.listhit.io/api/webhooks/twilio-status"

const c = vi.hoisted(() => ({ bySid: vi.fn(), refresh: vi.fn() }))
vi.mock("@/lib/twilio/credentials", () => ({
  getCredentialsBySubaccountSid: c.bySid,
  refreshSubaccountAuthToken: c.refresh,
}))

import { verifyTwilioWebhook, __resetRefreshThrottleForTests } from "@/lib/twilio/verify-webhook"

const creds = { orgId: ORG, subaccountSid: SUB_SID, authToken: SUB_TOKEN, apiKeySid: null, apiKeySecret: null, twimlAppSid: null }

describe("verifyTwilioWebhook refresh throttle", () => {
  beforeEach(() => {
    __resetRefreshThrottleForTests()
    vi.useRealTimers()
    process.env.LISTHIT_TWILIO_ACCOUNT_SID = "AC" + "p".repeat(32)
    process.env.LISTHIT_TWILIO_AUTH_TOKEN = "parent-token"
    c.bySid.mockReset().mockResolvedValue(creds)
    c.refresh.mockReset().mockResolvedValue(creds)
  })

  afterEach(() => vi.useRealTimers())

  test("two bad-signature requests within 60s → one refresh", async () => {
    const params = { AccountSid: SUB_SID, MessageSid: "SM1" }
    const forged = twilio.getExpectedTwilioSignature("forged-token", URL, params)

    const first = await verifyTwilioWebhook({ signature: forged, url: URL, params })
    const second = await verifyTwilioWebhook({ signature: forged, url: URL, params })

    expect(first).toEqual({ ok: false, reason: "bad_signature" })
    expect(second).toEqual({ ok: false, reason: "bad_signature" })
    expect(c.refresh).toHaveBeenCalledTimes(1)
  })

  test("after 60s another refresh is allowed", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-14T12:00:00Z"))
    const params = { AccountSid: SUB_SID, MessageSid: "SM1" }
    const forged = twilio.getExpectedTwilioSignature("forged-token", URL, params)

    await verifyTwilioWebhook({ signature: forged, url: URL, params })
    vi.setSystemTime(new Date("2026-10-14T12:01:01Z"))
    await verifyTwilioWebhook({ signature: forged, url: URL, params })

    expect(c.refresh).toHaveBeenCalledTimes(2)
  })
})
