import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { __getMockUser, __setMockUser, mockGetUser } from "@supabase/auth-helpers-nextjs"
import { __setAgentRecord, supabaseAdminAuthGetUserMock } from "@/lib/supabase/admin"
import {
  __setTokenResponse,
  createAgentTelephonyCredentialMock,
  createWebRTCTokenMock,
  deleteTelnyxCredentialMock,
} from "@/lib/telnyx/credentials"

const cookieStoreMock = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
}
// Prevent outbound network calls from Supabase client instances
global.fetch = jest.fn(async () => new Response("{}")) as any

jest.mock("next/headers", () => ({
  cookies: () => cookieStoreMock,
}))

jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({}) }),
      }),
    }),
    auth: {
      getUser: (...args: any[]) => supabaseAdminAuthGetUserMock(...args),
    },
  },
}))

describe("telnyx token route", () => {
  let POST: typeof import("../app/api/telnyx/token/route").POST
  let GET: typeof import("../app/api/telnyx/token/route").GET

  beforeEach(async () => {
    mockGetUser.mockReset()
    mockGetUser.mockImplementation(async () => ({ data: { user: __getMockUser() }, error: null }))
    createAgentTelephonyCredentialMock.mockReset()
    createWebRTCTokenMock.mockReset()
    deleteTelnyxCredentialMock.mockReset()
    cookieStoreMock.get.mockReset()
    cookieStoreMock.set.mockReset()
    cookieStoreMock.delete.mockReset()
    supabaseAdminAuthGetUserMock.mockReset()
    supabaseAdminAuthGetUserMock.mockResolvedValue({ data: { user: null }, error: null })
    __setTokenResponse({ token: "abc", expires_at: "2024-01-01" })
    __setMockUser({ id: "user-1" })
    process.env.VOICE_CONNECTION_ID = "voice-conn-test"
    process.env.CALL_CONTROL_APP_ID = ""
    process.env.TELNYX_VOICE_CONNECTION_ID = ""
    __setAgentRecord({
      id: "agent-1",
      auth_user_id: "user-1",
      sip_username: "sip_1001",
      sip_password: "pass-123",
      telnyx_credential_id: "cred-1",
    })

    __setTokenResponse({ token: "abc", expires_at: "2024-01-01" })

    const mod = await import("../app/api/telnyx/token/route")
    POST = mod.POST
    GET = mod.GET
  })

  test("GET returns 405", async () => {
    const res = await GET()
    expect(res.status).toBe(405)
    const payload = await res.json()
    expect(payload).toEqual({ ok: false, error: "Method not allowed" })
  })

  test("POST returns 401 when not authenticated", async () => {
    __setMockUser(null)
    const res = await POST(new Request("http://local"))
    expect(res.status).toBe(401)
  })

  test("POST returns token for authenticated agent", async () => {
    const res = await POST(new Request("http://local", { method: "POST" }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      token: "abc",
      sip_username: "sip_1001",
      sip_password: "pass-123",
    })
    expect(createWebRTCTokenMock).toHaveBeenCalledWith("cred-1")
    expect(createAgentTelephonyCredentialMock).not.toHaveBeenCalled()
  })

  test("POST returns null sip username when not configured", async () => {
    __setAgentRecord({
      id: "agent-1",
      auth_user_id: "user-1",
      sip_username: null,
      sip_password: null,
      telnyx_credential_id: "cred-1",
    })

    const res = await POST(new Request("http://local", { method: "POST" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      token: null,
      sip_username: null,
      sip_password: null,
    })
    expect(createWebRTCTokenMock).not.toHaveBeenCalled()
  })
})
