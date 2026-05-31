import { NextRequest } from "next/server"
import { POST } from "../app/api/telnyx/reject-call/route"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const authState = vi.hoisted(() => ({
  currentUser: { id: "user-1" } as { id: string } | null,
  callerRole: "user",
  permissions: [{ user_id: "user-1", permission_key: "calls.make_receive", granted: true }],
}))

function createPermissionQuery(rows: any[]) {
  const query = {
    eq: () => query,
    then: (resolve: any) => resolve({ data: rows, error: null }),
  }
  return query
}

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: authState.currentUser }, error: null }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role: authState.callerRole }, error: null }),
            }),
          }),
        }
      }

      if (table === "permissions") {
        return {
          select: () => createPermissionQuery(authState.permissions),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
  }),
}))

const fetchMock = vi.fn()
// @ts-ignore

global.fetch = fetchMock

describe("reject call route", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    authState.currentUser = { id: "user-1" }
    authState.callerRole = "user"
    authState.permissions = [{ user_id: "user-1", permission_key: "calls.make_receive", granted: true }]
    process.env.TELNYX_API_KEY = "KEY"
  })

  test("requires calls.make_receive", async () => {
    authState.permissions = []
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify({ callControlId: "C1" }) })

    const res = await POST(req)

    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("requires callControlId", async () => {
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify({}) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test("posts to Telnyx", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "{}" })
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify({ callControlId: "C1" }) })
    const res = await POST(req)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telnyx.com/v2/calls/C1/actions/reject",
      expect.objectContaining({ method: "POST" }),
    )
    expect(res.status).toBe(200)
  })
})
