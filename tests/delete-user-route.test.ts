import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/delete-user/route"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "a" } as { id: string } | null,
  callerRole: "admin",
  // Caller "a", "u1" and "admin-2" share org-A; "u2" lives in a different org.
  profiles: [] as any[],
  // Stubs the `select(count).eq(org_id).in(role)` result; null = derive it from profiles.
  orgAdminCount: null as number | null,
  deleted: [] as string[],
  profilesDeleted: [] as string[],
}))

vi.mock("../lib/supabase", () => {
  const client = {
    auth: {
      admin: {
        deleteUser: vi.fn(async (id: string) => {
          state.deleted.push(id)
          return { error: null }
        }),
      },
    },
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
        delete: () => ({
          eq: async (_column: string, id: string) => {
            state.profilesDeleted.push(id)
            return { error: null }
          },
        }),
      }
    },
  }
  return { supabaseAdmin: client }
})

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.currentUser }, error: null }) },
  }),
}))

function post(body: unknown) {
  return POST(new NextRequest("http://t", { method: "POST", body: JSON.stringify(body) }))
}

describe("delete-user route", () => {
  beforeEach(() => {
    state.currentUser = { id: "a" }
    state.callerRole = "admin"
    state.profiles = [
      { id: "a", role: "admin", org_id: "org-A" },
      { id: "u1", role: "user", org_id: "org-A" },
      { id: "admin-2", role: "admin", org_id: "org-A" },
      { id: "u2", role: "user", org_id: "org-B" },
    ]
    state.orgAdminCount = null
    state.deleted = []
    state.profilesDeleted = []
  })

  test("deletes a same-org user", async () => {
    const res = await post({ userId: "u1" })
    expect(res.status).toBe(200)
    expect(state.deleted).toContain("u1")
  })

  test("allows owner callers", async () => {
    state.callerRole = "owner"
    const res = await post({ userId: "u1" })
    expect(res.status).toBe(200)
    expect(state.deleted).toContain("u1")
  })

  test("refuses to delete the caller's own account", async () => {
    const res = await post({ userId: "a" })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe("You can't delete your own account.")
    expect(state.deleted).toEqual([])
  })

  test("refuses to delete the last admin on the org", async () => {
    state.orgAdminCount = 1
    const res = await post({ userId: "admin-2" })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe("You can't remove the only admin on this organization.")
    expect(state.deleted).toEqual([])
    expect(state.profilesDeleted).toEqual([])
  })

  test("deletes another admin when the org still has others", async () => {
    const res = await post({ userId: "admin-2" })
    expect(res.status).toBe(200)
    expect(state.deleted).toContain("admin-2")
  })

  test("refuses to delete a user in another org", async () => {
    const res = await post({ userId: "u2" })
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.reason).toBe("cross_org")
    expect(state.deleted).not.toContain("u2")
    expect(state.profilesDeleted).not.toContain("u2")
  })
})
