// Auth + minting tests for the voice access-token route. twilio is real (JWT
// minting is local, no network); routing state, per-org credentials and org
// context are mocked.

const h = vi.hoisted(() => {
  const state = {
    authUser: { id: "22222222-2222-2222-2222-222222222222" } as { id: string } | null,
    orgId: "11111111-1111-1111-1111-111111111111" as string | null,
  }
  return { state, loadRoutingStateMock: vi.fn(), getOrgCredentialsMock: vi.fn() }
})

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: h.state.authUser, orgId: h.state.orgId }),
}))
vi.mock("@/lib/providers/routing-state", () => ({ loadRoutingState: h.loadRoutingStateMock }))
vi.mock("@/lib/twilio/credentials", () => ({ getOrgCredentials: h.getOrgCredentialsMock }))

import { POST } from "../app/api/twilio/voice-token/route"
import { buildVoiceIdentity } from "@/lib/providers/voice/identity"

const APP_SID = "AP" + "1".repeat(32)
const SUB_SID = "AC" + "2".repeat(32)
const KEY_SID = "SK" + "3".repeat(32)

const LIVE_STATE = {
  has_credentials: true,
  subaccount_sid: SUB_SID,
  api_key_sid: KEY_SID,
  twiml_app_sid: APP_SID,
  phone_number: "+14705550123",
}

describe("twilio voice-token route", () => {
  const prevEnv = { ...process.env }

  beforeEach(() => {
    h.state.authUser = { id: "22222222-2222-2222-2222-222222222222" }
    h.state.orgId = "11111111-1111-1111-1111-111111111111"
    h.loadRoutingStateMock.mockReset().mockResolvedValue({ ...LIVE_STATE })
    h.getOrgCredentialsMock.mockReset().mockResolvedValue({
      orgId: h.state.orgId,
      subaccountSid: SUB_SID,
      authToken: "sub-token",
      apiKeySid: KEY_SID,
      apiKeySecret: "key-secret",
      twimlAppSid: APP_SID,
    })
    process.env.TELNYX_PINNED_ORG_IDS = ""
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

  test("409 voice_not_ready when a tenant row says telnyx (ignored → blocked)", async () => {
    h.loadRoutingStateMock.mockResolvedValue({ voice_provider: "telnyx", phone_number: "+14705550123", has_credentials: false })
    const res = await POST()
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("voice_not_ready")
    expect(h.getOrgCredentialsMock).not.toHaveBeenCalled()
  })

  test("409 when a pinned org would otherwise be twilio", async () => {
    process.env.TELNYX_PINNED_ORG_IDS = "11111111-1111-1111-1111-111111111111"
    const res = await POST()
    expect(res.status).toBe(409)
    expect(h.getOrgCredentialsMock).not.toHaveBeenCalled()
  })

  test("409 voice_not_ready when the org's voice credentials are missing", async () => {
    h.getOrgCredentialsMock.mockResolvedValue({
      orgId: h.state.orgId,
      subaccountSid: SUB_SID,
      authToken: "sub-token",
      apiKeySid: KEY_SID,
      apiKeySecret: null,
      twimlAppSid: APP_SID,
    })
    const res = await POST()
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("voice_not_ready")
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
    // V2: incoming is now allowed so the inbound webhook can ring this browser.
    expect(payload.grants.voice.incoming?.allow).toBe(true)
  })
})
