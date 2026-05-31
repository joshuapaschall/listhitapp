import { NextRequest } from "next/server"
import { PERMISSION_KEYS } from "../lib/permissions/keys"
import { grantsForTemplate } from "../lib/permissions/templates"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  // Route-handler client (drives requirePermission)
  currentUser: { id: "admin-1" } as { id: string } | null,
  callerRole: "user",
  callerPermissions: [] as { permission_key: string; granted?: boolean }[],
  // Admin client data + captured writes
  adminProfiles: [] as any[],
  adminPermissions: [] as any[],
  profileUpserts: [] as any[],
  permissionUpserts: [] as any[][],
  createUserCalls: [] as any[],
  resetEmails: [] as string[],
}))

function callerPermissionRows() {
  return state.callerPermissions.filter((permission) => permission.granted !== false)
}

function createPermissionQuery(rows: any[]) {
  const query: any = {
    eq: () => query,
    then: (resolve: any) => resolve({ data: rows, error: null }),
  }
  return query
}

function createRouteClient() {
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
        return { select: () => createPermissionQuery(callerPermissionRows()) }
      }
      throw new Error(`Unexpected route-client table ${table}`)
    },
  }
}

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => createRouteClient(),
}))

vi.mock("@/lib/supabase", () => {
  const supabaseAdmin = {
    auth: {
      admin: {
        createUser: vi.fn(async (payload: any) => {
          state.createUserCalls.push(payload)
          const user = { id: `u${state.createUserCalls.length}`, email: payload.email }
          return { data: { user }, error: null }
        }),
        deleteUser: vi.fn(async () => ({ error: null })),
        resetPasswordForEmail: vi.fn(async (email: string) => {
          state.resetEmails.push(email)
          return { error: null }
        }),
      },
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          upsert: async (row: any) => {
            state.profileUpserts.push(row)
            return { error: null }
          },
          select: () => ({
            order: async () => ({ data: state.adminProfiles, error: null }),
          }),
        }
      }
      if (table === "permissions") {
        const selectQuery: any = {
          then: (resolve: any) => resolve({ data: state.adminPermissions, error: null }),
        }
        return {
          upsert: async (rows: any[]) => {
            state.permissionUpserts.push(rows)
            return { error: null }
          },
          select: () => selectQuery,
        }
      }
      throw new Error(`Unexpected admin-client table ${table}`)
    },
  }
  return { supabaseAdmin, supabase: supabaseAdmin }
})

vi.mock("@/lib/telnyx/credentials", () => ({
  ensureUserTelephonyCredential: vi.fn(async () => undefined),
}))

function jsonRequest(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function asAdmin() {
  state.callerRole = "admin"
}

describe("admin users routes", () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = { id: "admin-1" }
    state.callerRole = "user"
    state.callerPermissions = []
    state.adminProfiles = []
    state.adminPermissions = []
    state.profileUpserts = []
    state.permissionUpserts = []
    state.createUserCalls = []
    state.resetEmails = []
  })

  describe("GET /api/admin/users", () => {
    async function getUsers() {
      const { GET } = await import("../app/api/admin/users/route")
      return GET()
    }

    test("is denied without users.manage", async () => {
      expect((await getUsers()).status).toBe(403)
    })

    test("returns users for an admin", async () => {
      asAdmin()
      state.adminProfiles = [
        {
          id: "u1",
          email: "alice@example.com",
          display_name: "Alice Agent",
          role: "user",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ]
      state.adminPermissions = [
        { user_id: "u1", permission_key: "buyers.view", granted: true },
        { user_id: "u1", permission_key: "buyers.delete", granted: false },
      ]

      const res = await getUsers()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.users).toHaveLength(1)
      expect(body.users[0]).toMatchObject({
        id: "u1",
        email: "alice@example.com",
        fullName: "Alice Agent",
        role: "user",
        permissions: ["buyers.view"],
      })
    })

    test("is allowed for a non-admin holding users.manage", async () => {
      state.callerRole = "user"
      state.callerPermissions = [{ permission_key: "users.manage", granted: true }]
      expect((await getUsers()).status).toBe(200)
    })
  })

  describe("POST /api/admin/apply-template", () => {
    async function applyTemplate(body: Record<string, unknown>) {
      const { POST } = await import("../app/api/admin/apply-template/route")
      return POST(jsonRequest("http://test/api/admin/apply-template", body))
    }

    test("is denied without users.manage", async () => {
      const res = await applyTemplate({ userId: "u1", templateId: "viewer" })
      expect(res.status).toBe(403)
      expect(state.permissionUpserts).toHaveLength(0)
    })

    test("applying viewer sets exactly the viewer grants true and all else false", async () => {
      asAdmin()
      const res = await applyTemplate({ userId: "u1", templateId: "viewer" })
      expect(res.status).toBe(200)

      const rows = state.permissionUpserts.at(-1)!
      expect(rows).toHaveLength(PERMISSION_KEYS.length)

      const viewerGrants = grantsForTemplate("viewer")
      const grantedKeys = rows
        .filter((row) => row.granted === true)
        .map((row) => row.permission_key)
        .sort()
      expect(grantedKeys).toEqual([...viewerGrants].sort())

      // Every other key is explicitly false
      for (const row of rows) {
        expect(row.granted).toBe(viewerGrants.includes(row.permission_key))
        expect(row.user_id).toBe("u1")
      }
    })

    test("rejects an unknown template id", async () => {
      asAdmin()
      const res = await applyTemplate({ userId: "u1", templateId: "superuser" })
      expect(res.status).toBe(400)
    })
  })

  describe("POST /api/admin/create-user", () => {
    async function createUser(body: Record<string, unknown>) {
      const { POST } = await import("../app/api/admin/create-user/route")
      return POST(jsonRequest("http://test/api/admin/create-user", body))
    }

    test("no longer requires a password in the body and never returns one", async () => {
      asAdmin()
      const res = await createUser({
        email: "newbie@example.com",
        fullName: "New Bie",
        role: "user",
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.user).toBeTruthy()
      expect(body.password).toBeUndefined()

      // Auth user created with a server-side throwaway password + confirmed email
      expect(state.createUserCalls).toHaveLength(1)
      expect(state.createUserCalls[0].email).toBe("newbie@example.com")
      expect(state.createUserCalls[0].password).toBeTruthy()
      expect(state.createUserCalls[0].email_confirm).toBe(true)

      // Profile gets role + display name, and a set-password email is sent
      expect(state.profileUpserts.at(-1)).toMatchObject({
        role: "user",
        display_name: "New Bie",
      })
      expect(state.resetEmails).toContain("newbie@example.com")
    })

    test("is denied without users.manage", async () => {
      const res = await createUser({ email: "x@example.com", role: "user" })
      expect(res.status).toBe(403)
      expect(state.createUserCalls).toHaveLength(0)
    })
  })
})
