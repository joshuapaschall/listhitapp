// POST /api/webhooks/twilio-events — Event Streams wake-ups. The sink URL is
// HMAC-signed per org; events are only signals (the engine re-fetches), and only
// events from the org's own subaccount count.
import crypto from "crypto"

const ORG = "55555555-5555-4555-8555-555555555555"
const SUB = "AC" + "5".repeat(32)
const KEY = Buffer.alloc(32, 7).toString("base64")

const h = vi.hoisted(() => ({ advance: vi.fn(), creds: vi.fn() }))

vi.mock("@/lib/org-twilio/engine", async () => {
  const actual = await vi.importActual<any>("@/lib/org-twilio/engine")
  return { eventsSignature: actual.eventsSignature, advanceRegistration: h.advance }
})
vi.mock("@/lib/twilio/credentials", () => ({ getOrgCredentials: h.creds }))

import { NextRequest } from "next/server"
import { POST } from "../app/api/webhooks/twilio-events/route"

const sigFor = (orgId: string) => crypto.createHmac("sha256", KEY).update(orgId).digest("hex")

const event = (type: string, accountsid = SUB) => ({
  specversion: "1.0",
  type,
  data: { accountsid, brandsid: "BN1", brandstatus: "APPROVED" },
})

const post = (qs: string, body: unknown) =>
  POST(new NextRequest(`https://app.listhit.io/api/webhooks/twilio-events${qs}`, { method: "POST", body: JSON.stringify(body) }))

describe("POST /api/webhooks/twilio-events", () => {
  beforeEach(() => {
    process.env.LISTHIT_SECRETS_KEY = KEY
    h.advance.mockReset().mockResolvedValue({ stage: "in_review", changed: false })
    h.creds.mockReset().mockResolvedValue({ orgId: ORG, subaccountSid: SUB })
  })

  test("a bad signature → 403, nothing advanced", async () => {
    const res = await post(`?org=${ORG}&sig=${"0".repeat(64)}`, [event("x")])
    expect(res.status).toBe(403)
    expect(h.advance).not.toHaveBeenCalled()
  })

  test("a signature for another org → 403", async () => {
    const res = await post(`?org=${ORG}&sig=${sigFor("someone-else")}`, [event("x")])
    expect(res.status).toBe(403)
  })

  test("a good signature advances once for a batch of 3 events", async () => {
    const res = await post(`?org=${ORG}&sig=${sigFor(ORG)}`, [
      event("com.twilio.messaging.compliance.brand-registration.brand-registered"),
      event("com.twilio.messaging.compliance.campaign-registration.campaign-submitted"),
      event("com.twilio.messaging.compliance.number-registration.pending"),
    ])
    expect(res.status).toBe(200)
    expect(h.advance).toHaveBeenCalledTimes(1)
    expect(h.advance).toHaveBeenCalledWith(ORG, {
      reason: "com.twilio.messaging.compliance.brand-registration.brand-registered",
    })
  })

  test("events from a foreign account are ignored", async () => {
    const res = await post(`?org=${ORG}&sig=${sigFor(ORG)}`, [event("x", "AC" + "9".repeat(32))])
    expect(res.status).toBe(200)
    expect(h.advance).not.toHaveBeenCalled()
  })

  test("an engine error is logged, never thrown — still 200", async () => {
    h.advance.mockRejectedValue(new Error("boom"))
    const res = await post(`?org=${ORG}&sig=${sigFor(ORG)}`, [event("x")])
    expect(res.status).toBe(200)
  })
})
