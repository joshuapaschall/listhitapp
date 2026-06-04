import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/update-permission/route"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "admin-1" } as { id: string } | null,
  callerRole: "admin",
  permissions: [] as any[],
  // Caller and u1 share org-A; u2 is in another org.
  profiles: [
    { id: "admin-1", org_id: "org-A" },
    { id: "u1", org_id: "org-A" },
    { id: "u2", org_id: "org-B" },
  ] as any[],
}))

vi.mock("@/lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "profiles") {
        // resolveOrgIdForUser + the route's same-org target lookup read org_id by id.
        return {
          select: () => ({
            eq: (_column: string, id: string) => ({
              maybeSingle: async () => {
                const profile = state.profiles.find((p) => p.id === id)
                return { data: profile ? { org_id: profile.org_id } : null, error: null }
              },
            }),
          }),
        }
      }
      if (table !== "permissions") throw new Error(`Unexpected table ${table}`)
      return {
        upsert: async (row: any) => {
          const idx = state.permissions.findIndex(
            (permission) =>
              permission.user_id === row.user_id &&
              permission.permission_key === row.permission_key,
          )
          if (idx === -1) {
            state.permissions.push(row)
          } else {
            state.permissions[idx] = { ...state.permissions[idx], ...row }
          }
          return { data: null, error: null }
        },
      }
    },
  }
  return { supabaseAdmin: client }
})

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: state.currentUser ? { user: state.currentUser } : null },
        error: null,
      }),
      getUser: async () => ({
        data: { user: state.currentUser },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`Unexpected table ${table}`)
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { role: state.callerRole }, error: null }),
          }),
        }),
      }
    },
  }),
}))

describe("update-permission route", () => {
  beforeEach(() => {
    state.currentUser = { id: "admin-1" }
    state.callerRole = "admin"
    state.permissions = []
  })

  test("rejects non-admin callers", async () => {
    state.callerRole = "user"
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ userId: "u1", permissionKey: "buyers.export", granted: true }),
    })

    const res = await POST(req)

    expect(res.status).toBe(403)
    expect(state.permissions).toEqual([])
  })

  test("allows admin callers to update permissions", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ userId: "u1", permissionKey: "buyers.export", granted: true }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(state.permissions).toEqual([
      { user_id: "u1", permission_key: "buyers.export", granted: true },
    ])
  })

  test("refuses to update permissions for a user in another org", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ userId: "u2", permissionKey: "buyers.export", granted: true }),
    })

    const res = await POST(req)

    expect(res.status).toBe(403)
    expect(state.permissions).toEqual([])
  })
})
