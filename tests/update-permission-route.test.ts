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
    { id: "admin-1", role: "admin", org_id: "org-A" },
    { id: "u1", role: "user", org_id: "org-A" },
    { id: "u2", role: "user", org_id: "org-B" },
  ] as any[],
}))

vi.mock("@/lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "profiles") {
        // Three readers hit this: requireOrgAdmin (role), resolveOrgIdForUser
        // (org_id), and requireSameOrgTarget (id, role, org_id).
        return {
          select: () => ({
            eq: (_column: string, id: string) => ({
              maybeSingle: async () => {
                const profile =
                  id === state.currentUser?.id
                    ? { ...state.profiles.find((p) => p.id === id), role: state.callerRole }
                    : state.profiles.find((p) => p.id === id)
                return { data: profile ?? null, error: null }
              },
            }),
          }),
        }
      }
      if (table !== "permissions") throw new Error(`Unexpected table ${table}`)
      return {
        // Models PostgREST for real: `permissions.id` is the PK, so without an
        // explicit onConflict the write is a plain INSERT that trips the
        // permissions_user_key unique constraint with 23505.
        upsert: async (rowOrRows: any, options?: { onConflict?: string }) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          const indexOf = (row: any) =>
            state.permissions.findIndex(
              (permission) =>
                permission.user_id === row.user_id &&
                permission.permission_key === row.permission_key,
            )

          if (options?.onConflict !== "user_id,permission_key") {
            if (rows.some((row) => indexOf(row) !== -1)) {
              return {
                data: null,
                error: {
                  code: "23505",
                  message:
                    'duplicate key value violates unique constraint "permissions_user_key"',
                },
              }
            }
            state.permissions.push(...rows.map((row) => ({ ...row })))
            return { data: null, error: null }
          }

          for (const row of rows) {
            const idx = indexOf(row)
            if (idx === -1) state.permissions.push({ ...row })
            else state.permissions[idx] = { ...state.permissions[idx], ...row }
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
      getUser: async () => ({
        data: { user: state.currentUser },
        error: null,
      }),
    },
  }),
}))

function post(body: unknown) {
  return POST(new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) }))
}

describe("update-permission route", () => {
  beforeEach(() => {
    state.currentUser = { id: "admin-1" }
    state.callerRole = "admin"
    state.permissions = []
  })

  test("rejects non-admin callers", async () => {
    state.callerRole = "user"

    const res = await post({ userId: "u1", permissionKey: "buyers.export", granted: true })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.reason).toBe("role")
    expect(state.permissions).toEqual([])
  })

  test("allows admin callers to update permissions", async () => {
    const res = await post({ userId: "u1", permissionKey: "buyers.export", granted: true })

    expect(res.status).toBe(200)
    expect(state.permissions).toEqual([
      { user_id: "u1", permission_key: "buyers.export", granted: true },
    ])
  })

  test("toggles an already-granted permission off instead of failing on 23505", async () => {
    state.permissions = [{ user_id: "u1", permission_key: "buyers.view", granted: true }]

    const res = await post({ userId: "u1", permissionKey: "buyers.view", granted: false })

    expect(res.status).toBe(200)
    expect(state.permissions).toEqual([
      { user_id: "u1", permission_key: "buyers.view", granted: false },
    ])
  })

  test("allows owner callers", async () => {
    state.callerRole = "owner"

    const res = await post({ userId: "u1", permissionKey: "buyers.export", granted: true })

    expect(res.status).toBe(200)
    expect(state.permissions).toEqual([
      { user_id: "u1", permission_key: "buyers.export", granted: true },
    ])
  })

  test("rejects an unknown permission key", async () => {
    const res = await post({ userId: "u1", permissionKey: "buyers.nope", granted: true })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("Unknown permission")
    expect(state.permissions).toEqual([])
  })

  test("refuses to let an admin revoke their own users.manage", async () => {
    const res = await post({
      userId: "admin-1",
      permissionKey: "users.manage",
      granted: false,
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe("You can't remove your own user-management access.")
    expect(state.permissions).toEqual([])
  })

  test("refuses to update permissions for a user in another org", async () => {
    const res = await post({ userId: "u2", permissionKey: "buyers.export", granted: true })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.reason).toBe("cross_org")
    expect(state.permissions).toEqual([])
  })
})
