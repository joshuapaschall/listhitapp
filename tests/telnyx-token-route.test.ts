import { describe, beforeEach, test, expect, jest } from "@jest/globals"

const getUserMock = jest.fn()
const createClientMock = jest.fn()
const selectMock = jest.fn()
const createAgentCredentialMock = jest.fn()
const createTokenMock = jest.fn()
const deleteCredentialMock = jest.fn()

jest.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}))

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: any[]) => createClientMock(...args),
}))

jest.mock("@/lib/telnyx/credentials", () => ({
  createAgentTelephonyCredential: (...args: any[]) =>
    createAgentCredentialMock(...args),
  createWebRTCToken: (...args: any[]) => createTokenMock(...args),
  deleteTelnyxCredential: (...args: any[]) => deleteCredentialMock(...args),
}))

describe("telnyx token route", () => {
  let POST: typeof import("../app/api/telnyx/token/route").POST
  let GET: typeof import("../app/api/telnyx/token/route").GET

  beforeEach(async () => {
    jest.resetModules()
    getUserMock.mockReset()
    createClientMock.mockReset()
    selectMock.mockReset()
    createAgentCredentialMock.mockReset()
    createTokenMock.mockReset()
    deleteCredentialMock.mockReset()
    process.env.VOICE_CONNECTION_ID = "voice-conn-test"
    process.env.CALL_CONTROL_APP_ID = ""
    process.env.TELNYX_VOICE_CONNECTION_ID = ""

    selectMock.mockImplementation(() => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: {
              id: "agent-1",
              auth_user_id: "user-1",
              sip_username: "sip_1001",
              sip_password: "pass-123",
              telnyx_credential_id: "cred-1",
            },
            error: null,
          }),
      }),
    }))

    createClientMock.mockReturnValue({
      from: () => ({
        select: (columns: string) => {
          selectMock(columns)
          return selectMock()
        },
        update: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({}) }),
        }),
      }),
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })

    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    createTokenMock.mockResolvedValue({ token: "abc", expires_at: "2024-01-01" })

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
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })
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
    expect(createTokenMock).toHaveBeenCalledWith("cred-1")
    expect(createAgentCredentialMock).not.toHaveBeenCalled()
  })

  test("POST returns null sip username when not configured", async () => {
    selectMock.mockImplementationOnce(() => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: {
              id: "agent-1",
              auth_user_id: "user-1",
              sip_username: null,
              sip_password: null,
              telnyx_credential_id: "cred-1",
            },
            error: null,
          }),
      }),
    }))

    const res = await POST(new Request("http://local", { method: "POST" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      token: null,
      sip_username: null,
      sip_password: null,
    })
    expect(createTokenMock).not.toHaveBeenCalled()
  })
})
