import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "user-1" } as { id: string } | null,
  callerRole: "user",
  permissions: [] as any[],
  signedUrl: "https://storage.test/signed-recording.mp3",
  credentialMock: vi.fn(),
  tokenMock: vi.fn(),
  signedUrlMock: vi.fn(),
}))

function permissionRows() {
  return state.permissions.filter((permission) => permission.granted !== false)
}

function createPermissionQuery(rows: any[]) {
  const query = {
    eq: () => query,
    then: (resolve: any) => resolve({ data: rows, error: null }),
  }
  return query
}

function createRouteClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: state.currentUser }, error: null }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role: state.callerRole }, error: null }),
            }),
          }),
        }
      }

      if (table === "permissions") {
        return {
          select: () => createPermissionQuery(permissionRows()),
        }
      }

      throw new Error(`Unexpected route-client table ${table}`)
    },
  }
}

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => createRouteClient(),
}))

vi.mock("@/lib/telnyx/credentials", () => ({
  ensureUserTelephonyCredential: (...args: any[]) => state.credentialMock(...args),
  createWebRTCToken: (...args: any[]) => state.tokenMock(...args),
}))

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "profiles") {
        // Every real user has a profiles.org_id; model that so resolveOrgIdForUser resolves.
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { org_id: "org-A" }, error: null }),
            }),
          }),
        }
      }
      if (table !== "calls") throw new Error(`Unexpected admin table ${table}`)
      // The route now chains .eq("call_sid", id).eq("org_id", orgId), so eq must be chainable.
      const query: any = {
        eq: () => query,
        single: async () => ({
          data: {
            recording_url: "recordings/call-1.mp3",
            status: "completed",
            from_number: "+15555550100",
            to_number: "+15555550123",
            started_at: "2026-05-31T12:00:00.000Z",
          },
          error: null,
        }),
      }
      return { select: () => query }
    },
    storage: {
      from: () => ({
        createSignedUrl: (...args: any[]) => state.signedUrlMock(...args),
      }),
    },
  },
}))

describe("calling permission gates", () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = { id: "user-1" }
    state.callerRole = "user"
    state.permissions = []
    state.signedUrl = "https://storage.test/signed-recording.mp3"
    state.credentialMock.mockReset().mockResolvedValue({ id: "cred-1", username: "sip-user" })
    state.tokenMock.mockReset().mockResolvedValue({ token: "webrtc-token" })
    state.signedUrlMock.mockReset().mockResolvedValue({ data: { signedUrl: state.signedUrl }, error: null })
  })

  function grant(permission: "calls.make_receive" | "calls.recordings") {
    state.permissions = [{ user_id: "user-1", permission_key: permission, granted: true }]
  }

  async function postWebrtcToken() {
    const { POST } = await import("../app/api/telnyx/webrtc-token/route")
    return POST()
  }

  async function getRecordingStream() {
    const { GET } = await import("../app/api/recordings/[id]/stream/route")
    const req = new NextRequest("http://test/api/recordings/call-1/stream")
    return GET(req, { params: { id: "call-1" } })
  }

  describe("POST /api/telnyx/webrtc-token", () => {
    test("denies anonymous users", async () => {
      state.currentUser = null

      const res = await postWebrtcToken()

      expect(res.status).toBe(401)
      expect(state.credentialMock).not.toHaveBeenCalled()
    })

    test("denies users without calls.make_receive", async () => {
      const res = await postWebrtcToken()

      expect(res.status).toBe(403)
      expect(state.credentialMock).not.toHaveBeenCalled()
    })

    test("allows users with calls.make_receive", async () => {
      grant("calls.make_receive")

      const res = await postWebrtcToken()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual({ ok: true, login_token: "webrtc-token", sip_username: "sip-user" })
      expect(state.credentialMock).toHaveBeenCalledWith("user-1")
      expect(state.tokenMock).toHaveBeenCalledWith("cred-1")
    })

    test("allows admins", async () => {
      state.callerRole = "admin"

      const res = await postWebrtcToken()

      expect(res.status).toBe(200)
    })
  })

  describe("GET /api/recordings/[id]/stream", () => {
    test("denies anonymous users", async () => {
      state.currentUser = null

      const res = await getRecordingStream()

      expect(res.status).toBe(401)
      expect(state.signedUrlMock).not.toHaveBeenCalled()
    })

    test("denies users without calls.recordings", async () => {
      const res = await getRecordingStream()

      expect(res.status).toBe(403)
      expect(state.signedUrlMock).not.toHaveBeenCalled()
    })

    test("allows users with calls.recordings", async () => {
      grant("calls.recordings")

      const res = await getRecordingStream()

      expect(res.status).toBe(307)
      expect(res.headers.get("location")).toBe(state.signedUrl)
      expect(state.signedUrlMock).toHaveBeenCalledWith("recordings/call-1.mp3", 3600)
    })

    test("allows admins", async () => {
      state.callerRole = "admin"

      const res = await getRecordingStream()

      expect(res.status).toBe(307)
    })
  })
})
