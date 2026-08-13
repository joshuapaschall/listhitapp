import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/update-role/route"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "admin-1" } as { id: string } | null,
  callerRole: "admin",
  profiles: [] as any[],
  // Stubs the `select(count).eq(org_id).in(role)` result; null = derive it from profiles.
  orgAdminCount: null as number | null,
  roleUpdates: [] as string[],
}))

vi.mock("@/lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`Unexpected table ${table}`)
      return {
        select: (_columns?: string, options?: { count?: string; head?: boolean }) => {
          if (options?.count) {
            return {
              eq: (_column: string, orgId: string) => ({
                in: async (_roleColumn: string, roles: string[]) => ({
                  count:
                    state.orgAdminCount ??
                    state.profiles.filter((p) => p.org_id === orgId && roles.includes(p.role))
                      .length,
                  error: null,
                }),
              }),
            }
          }
          // requireOrgAdmin (role), resolveOrgIdForUser (org_id), and
          // requireSameOrgTarget (id, role, org_id) all read by id.
          return {
            eq: (_column: string, id: string) => ({
              maybeSingle: async () => {
                const profile =
                  id === state.currentUser?.id
                    ? { ...state.profiles.find((p) => p.id === id), role: state.callerRole }
                    : state.profiles.find((p) => p.id === id)
                return { data: profile ?? null, error: null }
              },
            }),
          }
        },
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
      getUser: async () => ({ data: { user: state.currentUser }, error: null }),
    },
  }),
}))

function post(body: unknown) {
  return POST(new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) }))
}

const roleOf = (id: string) => state.profiles.find((profile) => profile.id === id)?.role

describe("update-role route", () => {
  beforeEach(() => {
    state.currentUser = { id: "admin-1" }
    state.callerRole = "admin"
    // Caller, u1 and admin-2 share org-A; u2 is in another org.
    state.profiles = [
      { id: "admin-1", role: "admin", org_id: "org-A" },
      { id: "u1", role: "user", org_id: "org-A" },
      { id: "admin-2", role: "admin", org_id: "org-A" },
      { id: "u2", role: "user", org_id: "org-B" },
    ]
    state.orgAdminCount = null
    state.roleUpdates = []
  })

  test("rejects non-admin callers", async () => {
    state.callerRole = "user"

    const res = await post({ userId: "u1", role: "admin" })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.reason).toBe("role")
    expect(roleOf("u1")).toBe("user")
  })

  test("allows admin callers to update roles", async () => {
    const res = await post({ userId: "u1", role: "admin" })

    expect(res.status).toBe(200)
    expect(roleOf("u1")).toBe("admin")
  })

  test("allows owner callers", async () => {
    state.callerRole = "owner"

    const res = await post({ userId: "u1", role: "admin" })

    expect(res.status).toBe(200)
    expect(roleOf("u1")).toBe("admin")
  })

  test("rejects a role outside profiles_role_check", async () => {
    const res = await post({ userId: "u1", role: "superadmin" })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Invalid role")
    expect(state.roleUpdates).toEqual([])
  })

  test("prevents admins from demoting themselves", async () => {
    const res = await post({ userId: "admin-1", role: "user" })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Admins cannot demote their own account")
    expect(roleOf("admin-1")).toBe("admin")
  })

  test("refuses to demote the last admin on the org", async () => {
    state.orgAdminCount = 1

    const res = await post({ userId: "admin-2", role: "user" })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("You can't remove the only admin on this organization.")
    expect(roleOf("admin-2")).toBe("admin")
  })

  test("demotes an admin when the org still has others", async () => {
    const res = await post({ userId: "admin-2", role: "user" })

    expect(res.status).toBe(200)
    expect(roleOf("admin-2")).toBe("user")
  })

  test("refuses to update a user in another org", async () => {
    const res = await post({ userId: "u2", role: "admin" })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.reason).toBe("cross_org")
    expect(state.roleUpdates).not.toContain("u2")
    expect(roleOf("u2")).toBe("user")
  })
})
