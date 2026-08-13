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
  // org_id by profile id — drives resolveOrgIdForUser + the apply-template target lookup.
  profileOrgById: {} as Record<string, string>,
  profileUpserts: [] as any[],
  permissionUpserts: [] as any[][],
  createUserCalls: [] as any[],
  generateLinkCalls: [] as any[],
  // auth.admin.listUsers is project-wide; the route must filter it to the org.
  authUsers: [] as { id: string; last_sign_in_at: string | null }[],
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
        // generateLink creates the auth user AND returns the invite token.
        generateLink: vi.fn(async (params: any) => {
          state.generateLinkCalls.push(params)
          return {
            data: {
              user: { id: `u${state.generateLinkCalls.length}`, email: params.email },
              properties: { hashed_token: "hashed-token-123" },
            },
            error: null,
          }
        }),
        listUsers: vi.fn(async () => ({
          data: { users: state.authUsers },
          error: null,
        })),
      },
    },
    from: (table: string) => {
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { name: "Org A", business_name: null },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === "profiles") {
        const makeSelect = () => {
          const filters: Record<string, any> = {}
          const query: any = {
            eq: (column: string, value: any) => {
              filters[column] = value
              return query
            },
            // resolveOrgIdForUser / apply-template target: org_id looked up by
            // profile id. requireOrgAdmin also reads the caller's role here —
            // it deliberately uses supabaseAdmin, not the RLS-scoped client.
            maybeSingle: async () => {
              const org = state.profileOrgById[filters.id]
              if (!org) return { data: null, error: null }
              const role = filters.id === state.currentUser?.id ? state.callerRole : "user"
              return { data: { id: filters.id, role, org_id: org }, error: null }
            },
            // GET list: profiles are org-scoped via .eq("org_id", orgId).
            order: async () => {
              const rows = state.adminProfiles.filter(
                (profile) => filters.org_id === undefined || profile.org_id === filters.org_id,
              )
              return { data: rows, error: null }
            },
          }
          return query
        }
        return {
          upsert: async (row: any) => {
            state.profileUpserts.push(row)
            return { error: null }
          },
          select: () => makeSelect(),
        }
      }
      if (table === "permissions") {
        const makeSelect = () => {
          const query: any = {
            in: () => query,
            then: (resolve: any) => resolve({ data: state.adminPermissions, error: null }),
          }
          return query
        }
        return {
          upsert: async (rows: any[]) => {
            state.permissionUpserts.push(rows)
            return { error: null }
          },
          select: () => makeSelect(),
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
    // Caller admin-1 and the default apply-template target u1 share org-A.
    state.profileOrgById = { "admin-1": "org-A", u1: "org-A" }
    state.profileUpserts = []
    state.permissionUpserts = []
    state.createUserCalls = []
    state.generateLinkCalls = []
    state.authUsers = []
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
          org_id: "org-A",
        },
      ]
      state.adminPermissions = [
        { user_id: "u1", permission_key: "buyers.view", granted: true },
        { user_id: "u1", permission_key: "buyers.delete", granted: false },
      ]
      state.authUsers = [
        { id: "u1", last_sign_in_at: "2026-02-01T00:00:00.000Z" },
        // Belongs to another org entirely — listUsers is project-wide.
        { id: "outsider", last_sign_in_at: "2026-03-01T00:00:00.000Z" },
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
        lastSignInAt: "2026-02-01T00:00:00.000Z",
        mustChangePassword: false,
        invitedAt: null,
      })
      expect(body.users.map((u: any) => u.id)).not.toContain("outsider")
    })

    test("excludes profiles belonging to another org", async () => {
      asAdmin()
      state.adminProfiles = [
        { id: "u1", email: "alice@example.com", role: "user", org_id: "org-A" },
        { id: "u2", email: "mallory@other.com", role: "user", org_id: "org-B" },
      ]

      const res = await getUsers()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.users).toHaveLength(1)
      expect(body.users[0].id).toBe("u1")
      expect(body.users.map((u: any) => u.id)).not.toContain("u2")
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

    test("defaults to the invite flow and never returns a password", async () => {
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

      // No method in the body means invite: generateLink creates the user and
      // mints the token. No throwaway password is ever generated.
      expect(state.generateLinkCalls).toHaveLength(1)
      expect(state.generateLinkCalls[0]).toMatchObject({
        type: "invite",
        email: "newbie@example.com",
      })
      expect(state.createUserCalls).toHaveLength(0)

      // Profile gets role, display name, and an org.
      expect(state.profileUpserts.at(-1)).toMatchObject({
        role: "user",
        display_name: "New Bie",
        org_id: "org-A",
      })
    })

    test("reports emailSent:false with the link when Resend is not configured", async () => {
      asAdmin()
      const res = await createUser({ email: "newbie@example.com", role: "user" })
      const body = await res.json()

      // RESEND_API_KEY is unset in tests, so the real sender reports a failure
      // rather than a false success — and hands back the link.
      expect(body.emailSent).toBe(false)
      expect(body.inviteUrl).toContain("/set-password?token_hash=hashed-token-123&type=invite")
      expect(body.emailError).toBe("RESEND_API_KEY not configured")
    })

    test("is denied for a non-admin caller", async () => {
      const res = await createUser({ email: "x@example.com", role: "user" })
      expect(res.status).toBe(403)
      expect(state.generateLinkCalls).toHaveLength(0)
      expect(state.createUserCalls).toHaveLength(0)
    })
  })
})
