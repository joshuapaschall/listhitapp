import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/update-role/route"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "admin-1" } as { id: string } | null,
  callerRole: "admin",
  profiles: [] as any[],
  roleUpdates: [] as string[],
}))

vi.mock("@/lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`Unexpected table ${table}`)
      return {
        // resolveOrgIdForUser + the route's same-org target lookup both read org_id by id.
        select: () => ({
          eq: (_column: string, id: string) => ({
            maybeSingle: async () => {
              const profile = state.profiles.find((p) => p.id === id)
              return { data: profile ? { org_id: profile.org_id } : null, error: null }
            },
          }),
        }),
        update: (value: any) => ({
          eq: async (_column: string, id: string) => {
            state.roleUpdates.push(id)
            const idx = state.profiles.findIndex((profile) => profile.id === id)
            if (idx !== -1) state.profiles[idx] = { ...state.profiles[idx], ...value }
            return { data: null, error: null }
          },
        }),
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

describe("update-role route", () => {
  beforeEach(() => {
    state.currentUser = { id: "admin-1" }
    state.callerRole = "admin"
    // Caller and u1 share org-A; u2 is in another org.
    state.profiles = [
      { id: "admin-1", role: "admin", org_id: "org-A" },
      { id: "u1", role: "user", org_id: "org-A" },
      { id: "u2", role: "user", org_id: "org-B" },
    ]
    state.roleUpdates = []
  })

  test("rejects non-admin callers", async () => {
    state.callerRole = "user"
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ userId: "u1", role: "admin" }),
    })

    const res = await POST(req)

    expect(res.status).toBe(403)
    expect(state.profiles.find((profile) => profile.id === "u1")?.role).toBe("user")
  })

  test("allows admin callers to update roles", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ userId: "u1", role: "admin" }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(state.profiles.find((profile) => profile.id === "u1")?.role).toBe("admin")
  })

  test("prevents admins from demoting themselves", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ userId: "admin-1", role: "user" }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Admins cannot demote their own account")
    expect(state.profiles.find((profile) => profile.id === "admin-1")?.role).toBe("admin")
  })

  test("refuses to update a user in another org", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ userId: "u2", role: "admin" }),
    })

    const res = await POST(req)

    expect(res.status).toBe(403)
    expect(state.roleUpdates).not.toContain("u2")
    expect(state.profiles.find((profile) => profile.id === "u2")?.role).toBe("user")
  })
})
