// The org proven by the signing subaccount is the authority. An inbound SMS
// signed by org A's subaccount but addressed to a DID that belongs to org B must
// be refused before anything reaches the shared inbound pipeline.
import { NextRequest } from "next/server"

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

const m = vi.hoisted(() => ({
  verify: vi.fn(),
  didOrg: vi.fn(),
  handle: vi.fn(),
}))

vi.mock("@/lib/twilio/verify-webhook", () => ({ verifyTwilioWebhook: m.verify }))
vi.mock("@/lib/inbound-numbers", () => ({ resolveOrgIdByDid: m.didOrg }))
vi.mock("@/lib/sms/inbound-handler", () => ({ handleInboundSms: m.handle }))

const { POST } = await import("../app/api/webhooks/twilio-incoming-sms/route")

function twilioReq(fields: Record<string, string>) {
  return new NextRequest("http://test/api/webhooks/twilio-incoming-sms", {
    method: "POST",
    body: new URLSearchParams(fields).toString(),
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": "sig" },
  })
}

const inbound = { AccountSid: "ACsubA", From: "+12223334444", To: "+18885551234", Body: "hi", MessageSid: "SM1" }

describe("twilio webhook org-mismatch guard (incoming SMS)", () => {
  beforeEach(() => {
    m.verify.mockReset().mockResolvedValue({ ok: true, accountSid: "ACsubA", account: "subaccount", orgId: ORG_A })
    m.didOrg.mockReset()
    m.handle.mockReset().mockResolvedValue(new Response(null, { status: 204 }))
  })

  test("subaccount of org A → DID owned by org B → 403, handler never called", async () => {
    m.didOrg.mockResolvedValue(ORG_B)
    const res = await POST(twilioReq(inbound))
    expect(res.status).toBe(403)
    expect(m.didOrg).toHaveBeenCalledWith("+18885551234")
    expect(m.handle).not.toHaveBeenCalled()
  })

  test("subaccount of org A → DID owned by org A → handled with the verified org", async () => {
    m.didOrg.mockResolvedValue(ORG_A)
    const res = await POST(twilioReq(inbound))
    expect(res.status).toBe(200)
    expect(m.handle).toHaveBeenCalledWith(expect.objectContaining({ provider: "twilio", verifiedOrgId: ORG_A }))
  })
})
