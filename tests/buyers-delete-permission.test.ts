import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "user-1" } as { id: string } | null,
  callerRole: "user",
  permissions: [] as any[],
  deletedGroupIds: [] as string[],
  hiddenBuyerIds: [] as string[],
  buyers: [{ id: "buyer-1", email: "buyer@example.com", fname: "Buyer" }] as any[],
}))

function createPermissionClient() {
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
        const query = {
          eq: () => query,
          then: (resolve: any) => resolve({ data: state.permissions, error: null }),
        }
        return {
          select: () => query,
        }
      }

      // Writes now run through the session-aware client from requireOrgContext().
      if (table === "buyer_groups") {
        return {
          delete: () => ({
            eq: () => ({
              in: async (_column: string, ids: string[]) => {
                state.deletedGroupIds.push(...ids)
                return { data: null, error: null }
              },
            }),
          }),
        }
      }

      if (table === "buyers") {
        return {
          update: () => ({
            eq: () => ({
              in: (_column: string, ids: string[]) => ({
                is: () => ({
                  select: async () => {
                    state.hiddenBuyerIds.push(...ids)
                    return { data: ids.map((id) => ({ id })), error: null }
                  },
                }),
              }),
            }),
          }),
        }
      }

      throw new Error(`Unexpected route client table ${table}`)
    },
  }
}

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => createPermissionClient(),
}))

// resolveOrgIdForUser (inside requireOrgContext) reads org_id from supabaseAdmin.profiles.
vi.mock("@/lib/supabase", () => {
  const supabaseAdmin = {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { org_id: "org-1" }, error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected admin client table ${table}`)
    },
  }
  return { supabase: supabaseAdmin, supabaseAdmin }
})

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
vi.stubGlobal("fetch", fetchMock)

describe("buyers delete permission gates", () => {
  beforeEach(() => {
    state.currentUser = { id: "user-1" }
    state.callerRole = "user"
    state.permissions = []
    state.deletedGroupIds = []
    state.hiddenBuyerIds = []
    fetchMock.mockClear()
  })

  test("rejects non-permitted users before bulk delete logic runs", async () => {
    const { POST } = await import("../app/api/buyers/bulk-delete/route")
    const req = new NextRequest("http://test/api/buyers/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids: ["buyer-1"] }),
    })

    const res = await POST(req)

    expect(res.status).toBe(403)
    expect(state.hiddenBuyerIds).toEqual([])
    expect(state.deletedGroupIds).toEqual([])
  })

  test("allows admins to bulk delete buyers", async () => {
    state.callerRole = "admin"
    const { POST } = await import("../app/api/buyers/bulk-delete/route")
    const req = new NextRequest("http://test/api/buyers/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids: ["buyer-1"] }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(state.hiddenBuyerIds).toEqual(["buyer-1"])
    expect(state.deletedGroupIds).toEqual(["buyer-1"])
  })

  test("allows users granted buyers.delete on the single delete route", async () => {
    state.permissions = [{ user_id: "user-1", permission_key: "buyers.delete", granted: true }]
    const { POST } = await import("../app/api/buyers/[id]/delete/route")
    const req = new NextRequest("http://test/api/buyers/buyer-1/delete", {
      method: "POST",
    })

    const res = await POST(req, { params: { id: "buyer-1" } })

    expect(res.status).toBe(200)
    expect(state.hiddenBuyerIds).toEqual(["buyer-1"])
    expect(state.deletedGroupIds).toEqual(["buyer-1"])
  })
})
