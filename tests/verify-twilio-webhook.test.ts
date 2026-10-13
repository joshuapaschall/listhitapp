// verifyTwilioWebhook: the one verifier for every Twilio webhook. Signatures are
// produced with the real twilio SDK so a passing test proves the right token was
// used for the right account.
import twilio from "twilio"

const PARENT_SID = "AC" + "p".repeat(32)
const PARENT_TOKEN = "parent-auth-token"
const SUB_SID = "AC" + "s".repeat(32)
const SUB_TOKEN = "subaccount-auth-token"
const ROTATED_TOKEN = "subaccount-rotated-token"
const ORG = "11111111-1111-4111-8111-111111111111"
const URL = "https://app.listhit.io/api/webhooks/twilio-incoming-sms"

const c = vi.hoisted(() => ({
  bySid: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock("@/lib/twilio/credentials", () => ({
  getCredentialsBySubaccountSid: c.bySid,
  refreshSubaccountAuthToken: c.refresh,
}))

import { verifyTwilioWebhook } from "@/lib/twilio/verify-webhook"

const sign = (token: string, params: Record<string, string>) =>
  twilio.getExpectedTwilioSignature(token, URL, params)

const subCreds = (authToken: string) => ({
  orgId: ORG,
  subaccountSid: SUB_SID,
  authToken,
  apiKeySid: null,
  apiKeySecret: null,
  twimlAppSid: null,
})

describe("verifyTwilioWebhook", () => {
  beforeEach(() => {
    process.env.LISTHIT_TWILIO_ACCOUNT_SID = PARENT_SID
    process.env.LISTHIT_TWILIO_AUTH_TOKEN = PARENT_TOKEN
    c.bySid.mockReset().mockImplementation(async (sid: string) => (sid === SUB_SID ? subCreds(SUB_TOKEN) : null))
    c.refresh.mockReset().mockResolvedValue(subCreds(SUB_TOKEN))
  })

  test("parent account + valid signature → ok, parent, no org", async () => {
    const params = { AccountSid: PARENT_SID, MessageSid: "SM1", Body: "hi" }
    const result = await verifyTwilioWebhook({ signature: sign(PARENT_TOKEN, params), url: URL, params })
    expect(result).toEqual({ ok: true, accountSid: PARENT_SID, account: "parent", orgId: null })
    expect(c.bySid).not.toHaveBeenCalled()
  })

  test("parent account signed with the wrong token → bad_signature", async () => {
    const params = { AccountSid: PARENT_SID, MessageSid: "SM1" }
    const result = await verifyTwilioWebhook({ signature: sign("nope", params), url: URL, params })
    expect(result).toEqual({ ok: false, reason: "bad_signature" })
  })

  test("known subaccount + signature made with ITS token → ok with the org", async () => {
    const params = { AccountSid: SUB_SID, MessageSid: "SM2", Body: "hello" }
    const result = await verifyTwilioWebhook({ signature: sign(SUB_TOKEN, params), url: URL, params })
    expect(result).toEqual({ ok: true, accountSid: SUB_SID, account: "subaccount", orgId: ORG })
    expect(c.refresh).not.toHaveBeenCalled()
  })

  test("a subaccount webhook signed with the PARENT token is rejected", async () => {
    const params = { AccountSid: SUB_SID, MessageSid: "SM3" }
    const result = await verifyTwilioWebhook({ signature: sign(PARENT_TOKEN, params), url: URL, params })
    expect(result).toEqual({ ok: false, reason: "bad_signature" })
  })

  test("unknown AccountSid → unknown_account", async () => {
    const params = { AccountSid: "AC" + "x".repeat(32), MessageSid: "SM4" }
    const result = await verifyTwilioWebhook({ signature: sign(SUB_TOKEN, params), url: URL, params })
    expect(result).toEqual({ ok: false, reason: "unknown_account" })
    expect(c.refresh).not.toHaveBeenCalled()
  })

  test("bad signature → bad_signature after exactly one token refresh", async () => {
    const params = { AccountSid: SUB_SID, MessageSid: "SM5" }
    const result = await verifyTwilioWebhook({ signature: sign("forged", params), url: URL, params })
    expect(result).toEqual({ ok: false, reason: "bad_signature" })
    expect(c.refresh).toHaveBeenCalledTimes(1)
    expect(c.refresh).toHaveBeenCalledWith(ORG)
  })

  test("a rotated subaccount token validates after the single refresh", async () => {
    c.refresh.mockResolvedValue(subCreds(ROTATED_TOKEN))
    const params = { AccountSid: SUB_SID, MessageSid: "SM6" }
    const result = await verifyTwilioWebhook({ signature: sign(ROTATED_TOKEN, params), url: URL, params })
    expect(result).toEqual({ ok: true, accountSid: SUB_SID, account: "subaccount", orgId: ORG })
    expect(c.refresh).toHaveBeenCalledTimes(1)
  })

  test("missing signature → missing_signature", async () => {
    const params = { AccountSid: SUB_SID, MessageSid: "SM7" }
    const result = await verifyTwilioWebhook({ signature: "", url: URL, params })
    expect(result).toEqual({ ok: false, reason: "missing_signature" })
    expect(c.bySid).not.toHaveBeenCalled()
  })

  test("missing AccountSid → missing_account", async () => {
    const params = { MessageSid: "SM8" }
    const result = await verifyTwilioWebhook({ signature: sign(SUB_TOKEN, params), url: URL, params })
    expect(result).toEqual({ ok: false, reason: "missing_account" })
  })
})
