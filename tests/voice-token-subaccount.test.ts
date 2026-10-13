// The browser voice token must be minted with the ORG's own subaccount
// credentials: its API key (iss), its subaccount SID (sub) and its TwiML App.

const h = vi.hoisted(() => ({
  state: { routing: null as any, creds: null as any },
}))

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: { id: "22222222-2222-4222-8222-222222222222" }, orgId: "11111111-1111-4111-8111-111111111111" }),
}))
vi.mock("@/lib/providers/routing-state", () => ({ loadRoutingState: async () => h.state.routing }))
vi.mock("@/lib/twilio/credentials", () => ({ getOrgCredentials: async () => h.state.creds }))

import { POST } from "../app/api/twilio/voice-token/route"

const SUB_SID = "AC" + "a".repeat(32)
const KEY_SID = "SK" + "b".repeat(32)
const APP_SID = "AP" + "c".repeat(32)

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64").toString("utf8"))

describe("voice token minted from the org's subaccount", () => {
  const prevEnv = { ...process.env }

  beforeEach(() => {
    process.env.TELNYX_PINNED_ORG_IDS = "org-owner"
    // The shared parent voice credentials must play no part.
    delete process.env.LISTHIT_TWILIO_ACCOUNT_SID
    h.state.routing = {
      has_credentials: true,
      subaccount_sid: SUB_SID,
      api_key_sid: KEY_SID,
      twiml_app_sid: APP_SID,
      phone_number: "+14705550123",
    }
    h.state.creds = {
      orgId: "11111111-1111-4111-8111-111111111111",
      subaccountSid: SUB_SID,
      authToken: "sub-token",
      apiKeySid: KEY_SID,
      apiKeySecret: "org-key-secret",
      twimlAppSid: APP_SID,
    }
  })

  afterAll(() => {
    process.env = prevEnv
  })

  test("iss is the org's API key, sub is the subaccount, grant names the org's TwiML App", async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    const { token } = await res.json()
    const [headerB64, payloadB64] = token.split(".")
    const header = decode(headerB64)
    const payload = decode(payloadB64)
    expect(header.cty).toBe("twilio-fpa;v=1")
    expect(payload.iss).toBe(KEY_SID)
    expect(payload.sub).toBe(SUB_SID)
    expect(payload.grants.voice.outgoing.application_sid).toBe(APP_SID)
  })

  test("blocked org → 409 voice_not_ready", async () => {
    h.state.routing = { has_credentials: true, subaccount_sid: SUB_SID, api_key_sid: KEY_SID, phone_number: "+14705550123" }
    const res = await POST()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual(expect.objectContaining({ code: "voice_not_ready" }))
  })

  test("org with no routing row at all → 409 voice_not_ready", async () => {
    h.state.routing = null
    const res = await POST()
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("voice_not_ready")
  })
})
