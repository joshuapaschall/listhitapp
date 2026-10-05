// One control sets a role AND a permission set, so the two can never disagree.
// Mirrors the admin-guard mocking style of tests/admin-users-route.test.ts.

import { NextRequest } from "next/server"
import { PERMISSION_KEYS } from "../lib/permissions/keys"
import { grantsForTemplate } from "../lib/permissions/templates"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "admin-1" } as { id: string } | null,
  callerRole: "admin",
  // profile id -> { role, org_id }
  profiles: {} as Record<string, { role: string; org_id: string | null }>,
  adminCount: 2,
  permissionUpserts: [] as any[][],
  profileUpdates: [] as { data: any; id: string }[],
  grantedAfter: ["buyers.view"] as string[],
}))

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.currentUser }, error: null }) },
  }),
}))

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "profiles") {
        const filters: Record<string, any> = {}
        const query: any = {
          select: (_cols?: string, opts?: any) => {
            query._head = opts?.head === true
            return query
          },
          eq: (col: string, val: any) => {
            filters[col] = val
            return query
          },
          in: (_col: string, _vals: string[]) => {
            // countOrgAdmins: .select(id,{count}).eq(org_id).in(role,[...])
            return Promise.resolve({ count: state.adminCount, data: null, error: null })
          },
          maybeSingle: async () => {
            const row = state.profiles[filters.id]
            if (!row) return { data: null, error: null }
            return { data: { id: filters.id, role: row.role, org_id: row.org_id }, error: null }
          },
          update: (data: any) => ({
            eq: async (_col: string, id: string) => {
              state.profileUpdates.push({ data, id })
              return { error: null }
            },
          }),
        }
        return query
      }
      if (table === "permissions") {
        return {
          upsert: async (rows: any[]) => {
            state.permissionUpserts.push(rows)
            return { error: null }
          },
          select: () => ({
            eq: () => ({
              eq: async () =>
                ({
                  data: state.grantedAfter.map((permission_key) => ({ permission_key })),
                  error: null,
                }) as any,
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  },
}))

import { POST } from "../app/api/admin/set-access-level/route"

const req = (body: unknown) =>
  new NextRequest("http://test/api/admin/set-access-level", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

describe("POST /api/admin/set-access-level", () => {
  beforeEach(() => {
    state.currentUser = { id: "admin-1" }
    state.callerRole = "admin"
    state.profiles = {
      "admin-1": { role: "admin", org_id: "org-A" },
      u1: { role: "user", org_id: "org-A" },
      "admin-2": { role: "admin", org_id: "org-A" },
      owner1: { role: "owner", org_id: "org-A" },
      outsider: { role: "user", org_id: "org-B" },
    }
    state.adminCount = 2
    state.permissionUpserts = []
    state.profileUpdates = []
    state.grantedAfter = ["buyers.view"]
  })

  test("rejects an invalid level", async () => {
    const res = await POST(req({ userId: "u1", level: "superuser" }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Invalid level" })
    expect(state.permissionUpserts).toHaveLength(0)
    expect(state.profileUpdates).toHaveLength(0)
  })

  test("refuses to change your own access level", async () => {
    const res = await POST(req({ userId: "admin-1", level: "viewer" }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: "You can't change your own access level.",
    })
    expect(state.permissionUpserts).toHaveLength(0)
    expect(state.profileUpdates).toHaveLength(0)
  })

  test("refuses to change the owner", async () => {
    const res = await POST(req({ userId: "owner1", level: "viewer" }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: "The owner's access can't be changed here.",
    })
    expect(state.profileUpdates).toHaveLength(0)
  })

  test("refuses to demote the last admin", async () => {
    state.adminCount = 1
    const res = await POST(req({ userId: "admin-2", level: "agent" }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: "You can't remove the only admin on this organization.",
    })
    expect(state.permissionUpserts).toHaveLength(0)
    expect(state.profileUpdates).toHaveLength(0)
  })

  test("a cross-org target is denied by requireSameOrgTarget", async () => {
    const res = await POST(req({ userId: "outsider", level: "viewer" }))
    expect(res.status).toBe(403)
    expect((await res.json()).reason).toBe("cross_org")
    expect(state.permissionUpserts).toHaveLength(0)
    expect(state.profileUpdates).toHaveLength(0)
  })

  test("admin grants every key and sets role admin", async () => {
    state.grantedAfter = [...PERMISSION_KEYS]
    const res = await POST(req({ userId: "u1", level: "admin" }))
    expect(res.status).toBe(200)

    const rows = state.permissionUpserts.at(-1)!
    expect(rows).toHaveLength(PERMISSION_KEYS.length)
    expect(rows.every((row) => row.granted === true)).toBe(true)
    expect(rows.every((row) => row.user_id === "u1")).toBe(true)

    expect(state.profileUpdates).toEqual([{ data: { role: "admin" }, id: "u1" }])
    await expect(res.json()).resolves.toEqual({
      ok: true,
      role: "admin",
      permissions: [...PERMISSION_KEYS],
    })
  })

  test("agent writes exactly the agent template and sets role user", async () => {
    const agentGrants = grantsForTemplate("agent")
    state.grantedAfter = [...agentGrants]
    const res = await POST(req({ userId: "u1", level: "agent" }))
    expect(res.status).toBe(200)

    const rows = state.permissionUpserts.at(-1)!
    expect(rows).toHaveLength(PERMISSION_KEYS.length)
    const grantedKeys = rows
      .filter((row) => row.granted === true)
      .map((row) => row.permission_key)
      .sort()
    expect(grantedKeys).toEqual([...agentGrants].sort())
    // Every other key is written explicitly false, not just left absent.
    for (const row of rows) {
      expect(row.granted).toBe(agentGrants.includes(row.permission_key))
    }

    expect(state.profileUpdates).toEqual([{ data: { role: "user" }, id: "u1" }])
    expect((await res.json()).role).toBe("user")
  })

  test("custom leaves permissions untouched and sets role user", async () => {
    state.grantedAfter = ["buyers.view", "inbox.view"]
    const res = await POST(req({ userId: "admin-2", level: "custom" }))
    expect(res.status).toBe(200)

    // No permission write at all — the existing grants are what makes it custom.
    expect(state.permissionUpserts).toHaveLength(0)
    expect(state.profileUpdates).toEqual([{ data: { role: "user" }, id: "admin-2" }])
    await expect(res.json()).resolves.toEqual({
      ok: true,
      role: "user",
      permissions: ["buyers.view", "inbox.view"],
    })
  })

  test("a non-admin caller is denied", async () => {
    state.callerRole = "user"
    state.profiles["admin-1"] = { role: "user", org_id: "org-A" }
    const res = await POST(req({ userId: "u1", level: "viewer" }))
    expect(res.status).toBe(403)
    expect(state.permissionUpserts).toHaveLength(0)
    expect(state.profileUpdates).toHaveLength(0)
  })
})
