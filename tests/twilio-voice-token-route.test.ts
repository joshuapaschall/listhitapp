// Auth + minting tests for the voice access-token route. twilio is real (JWT
// minting is local, no network); getOrgTwilio + org context are mocked.

const h = vi.hoisted(() => {
  const state = {
    authUser: { id: "22222222-2222-2222-2222-222222222222" } as { id: string } | null,
    orgId: "11111111-1111-1111-1111-111111111111" as string | null,
  }
  return { state, getOrgTwilioMock: vi.fn() }
})

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: h.state.authUser, orgId: h.state.orgId }),
}))
vi.mock("@/lib/org-twilio/service", () => ({ getOrgTwilio: h.getOrgTwilioMock }))

import { POST } from "../app/api/twilio/voice-token/route"
import { buildVoiceIdentity } from "@/lib/providers/voice/identity"

const APP_SID = "AP" + "1".repeat(32)

describe("twilio voice-token route", () => {
  const prevEnv = { ...process.env }

  beforeEach(() => {
    h.state.authUser = { id: "22222222-2222-2222-2222-222222222222" }
    h.state.orgId = "11111111-1111-1111-1111-111111111111"
    h.getOrgTwilioMock.mockReset().mockResolvedValue({
      voice_provider: "twilio",
      phone_number: "+14705550123",
    })
    process.env.TELNYX_PINNED_ORG_IDS = ""
    process.env.LISTHIT_TWILIO_ACCOUNT_SID = "AC" + "0".repeat(32)
    process.env.LISTHIT_TWILIO_API_KEY_SID = "SK" + "0".repeat(32)
    process.env.LISTHIT_TWILIO_API_KEY_SECRET = "test_secret"
    process.env.LISTHIT_TWILIO_TWIML_APP_SID = APP_SID
  })

  afterAll(() => {
    process.env = prevEnv
  })

  test("401 when there is no user", async () => {
    h.state.authUser = null
    const res = await POST()
    expect(res.status).toBe(401)
  })

  test("400 when there is no org", async () => {
    h.state.orgId = null
    const res = await POST()
    expect(res.status).toBe(400)
  })

  test("409 when the org resolves to telnyx", async () => {
    h.getOrgTwilioMock.mockResolvedValue({ voice_provider: "telnyx", phone_number: "+14705550123" })
    const res = await POST()
    expect(res.status).toBe(409)
  })

  test("409 when a pinned org would otherwise be twilio", async () => {
    process.env.TELNYX_PINNED_ORG_IDS = "11111111-1111-1111-1111-111111111111"
    const res = await POST()
    expect(res.status).toBe(409)
  })

  test("500 when a Twilio env var is missing", async () => {
    delete process.env.LISTHIT_TWILIO_TWIML_APP_SID
    const res = await POST()
    expect(res.status).toBe(500)
  })

  test("mints a JWT whose grant names the identity and TwiML App", async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    const expectedIdentity = buildVoiceIdentity(h.state.orgId!, h.state.authUser!.id)
    expect(body.identity).toBe(expectedIdentity)
    expect(body.ttl).toBe(3600)

    const payload = JSON.parse(Buffer.from(body.token.split(".")[1], "base64").toString("utf8"))
    expect(payload.grants.identity).toBe(expectedIdentity)
    expect(payload.grants.voice.outgoing.application_sid).toBe(APP_SID)
    expect(payload.grants.voice.incoming?.allow).toBeFalsy()
  })
})
