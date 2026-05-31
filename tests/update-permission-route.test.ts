import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/update-permission/route"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "admin-1" } as { id: string } | null,
  callerRole: "admin",
  permissions: [] as any[],
}))

vi.mock("@/lib/supabase", () => {
  const client = {
    from: (table: string) => {
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
})
