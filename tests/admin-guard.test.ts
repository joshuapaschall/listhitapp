import {
  countOrgAdmins,
  requireOrgAdmin,
  requireSameOrgTarget,
  type AdminContext,
} from "../lib/auth/admin-guard"

const state = vi.hoisted(() => ({
  currentUser: { id: "admin-1" } as { id: string } | null,
  profiles: [] as any[],
  orgId: "org-A" as string | null,
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
                  count: state.profiles.filter(
                    (p) => p.org_id === orgId && roles.includes(p.role),
                  ).length,
                  error: null,
                }),
              }),
            }
          }
          return {
            eq: (_column: string, id: string) => ({
              maybeSingle: async () => ({
                data: state.profiles.find((p) => p.id === id) ?? null,
                error: null,
              }),
            }),
          }
        },
      }
    },
  }
  return { supabaseAdmin: client }
})

vi.mock("@/lib/auth/org-context", () => ({
  resolveOrgIdForUser: async () => state.orgId,
}))

// requireOrgAdmin only reaches for `auth`, so a minimal stub stands in for the
// route-handler client.
const clientFor = (user: { id: string } | null) =>
  ({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
  }) as any

const ctx: AdminContext = { userId: "admin-1", orgId: "org-A", role: "admin" }

describe("requireOrgAdmin", () => {
  beforeEach(() => {
    state.currentUser = { id: "admin-1" }
    state.orgId = "org-A"
    state.profiles = [
      { id: "admin-1", role: "admin", org_id: "org-A" },
      { id: "owner-1", role: "owner", org_id: "org-A" },
      { id: "u1", role: "user", org_id: "org-A" },
      { id: "orphan", role: "admin", org_id: null },
      { id: "u2", role: "user", org_id: "org-B" },
    ]
  })

  test("401s with no session", async () => {
    const result = await requireOrgAdmin(clientFor(null))

    expect("denied" in result).toBe(true)
    if (!("denied" in result)) return
    expect(result.denied.status).toBe(401)
    expect(await result.denied.json()).toEqual({
      error: "Your session expired. Sign in again.",
    })
  })

  test("403s a plain user with reason 'role'", async () => {
    const result = await requireOrgAdmin(clientFor({ id: "u1" }))

    expect("denied" in result).toBe(true)
    if (!("denied" in result)) return
    expect(result.denied.status).toBe(403)
    expect((await result.denied.json()).reason).toBe("role")
  })

  test("allows an owner", async () => {
    const result = await requireOrgAdmin(clientFor({ id: "owner-1" }))

    expect("ctx" in result).toBe(true)
    if (!("ctx" in result)) return
    expect(result.ctx).toEqual({ userId: "owner-1", orgId: "org-A", role: "owner" })
  })

  test("403s with reason 'no_org' when the caller has no org", async () => {
    state.orgId = null

    const result = await requireOrgAdmin(clientFor({ id: "admin-1" }))

    expect("denied" in result).toBe(true)
    if (!("denied" in result)) return
    expect(result.denied.status).toBe(403)
    expect((await result.denied.json()).reason).toBe("no_org")
  })
})

describe("requireSameOrgTarget", () => {
  beforeEach(() => {
    state.profiles = [
      { id: "admin-1", role: "admin", org_id: "org-A" },
      { id: "u1", role: "user", org_id: "org-A" },
      { id: "orphan", role: "user", org_id: null },
      { id: "u2", role: "user", org_id: "org-B" },
    ]
  })

  test("404s an unknown target", async () => {
    const result = await requireSameOrgTarget("nobody", ctx)

    expect("denied" in result).toBe(true)
    if (!("denied" in result)) return
    expect(result.denied.status).toBe(404)
  })

  test("returns a same-org target", async () => {
    const result = await requireSameOrgTarget("u1", ctx)

    expect("target" in result).toBe(true)
    if (!("target" in result)) return
    expect(result.target).toEqual({ id: "u1", role: "user", org_id: "org-A" })
  })

  test("403s a cross-org target", async () => {
    const result = await requireSameOrgTarget("u2", ctx)

    expect("denied" in result).toBe(true)
    if (!("denied" in result)) return
    expect(result.denied.status).toBe(403)
    expect((await result.denied.json()).reason).toBe("cross_org")
  })

  test("treats a null org_id as cross-org, never as a match", async () => {
    const result = await requireSameOrgTarget("orphan", ctx)

    expect("denied" in result).toBe(true)
    if (!("denied" in result)) return
    expect(result.denied.status).toBe(403)
    expect((await result.denied.json()).reason).toBe("cross_org")
  })
})

describe("countOrgAdmins", () => {
  beforeEach(() => {
    state.profiles = [
      { id: "admin-1", role: "admin", org_id: "org-A" },
      { id: "owner-1", role: "owner", org_id: "org-A" },
      { id: "u1", role: "user", org_id: "org-A" },
      { id: "admin-2", role: "admin", org_id: "org-B" },
    ]
  })

  test("counts admins and owners in the org only", async () => {
    expect(await countOrgAdmins("org-A")).toBe(2)
    expect(await countOrgAdmins("org-B")).toBe(1)
    expect(await countOrgAdmins("org-C")).toBe(0)
  })
})
