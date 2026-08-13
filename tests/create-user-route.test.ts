import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/create-user/route"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "admin-1" } as { id: string } | null,
  callerRole: "admin",
  // Caller lives in org-A. "taken@test.com" already has a profile there.
  profiles: [] as any[],
  profileUpserts: [] as any[],
  permissionUpserts: [] as any[],
  createUserCalls: [] as any[],
  generateLinkCalls: [] as any[],
  deletedUsers: [] as string[],
  // Toggles for the failure paths.
  profileUpsertError: null as any,
  generateLinkError: null as any,
  createUserError: null as any,
  hashedToken: "hashed-token-123" as string | undefined,
  emailResults: [] as any[],
  inviteEmailResult: { sent: true } as { sent: boolean; error?: string },
  accountReadyResult: { sent: true } as { sent: boolean; error?: string },
}))

vi.mock("@/lib/supabase", () => {
  const client = {
    auth: {
      admin: {
        generateLink: vi.fn(async (params: any) => {
          state.generateLinkCalls.push(params)
          if (state.generateLinkError) return { data: null, error: state.generateLinkError }
          return {
            data: {
              user: { id: "new-user", email: params.email },
              properties: { hashed_token: state.hashedToken },
            },
            error: null,
          }
        }),
        createUser: vi.fn(async (params: any) => {
          state.createUserCalls.push(params)
          if (state.createUserError) return { data: null, error: state.createUserError }
          return { data: { user: { id: "new-user", email: params.email } }, error: null }
        }),
        deleteUser: vi.fn(async (id: string) => {
          state.deletedUsers.push(id)
          return { error: null }
        }),
      },
    },
    from: (table: string) => {
      if (table === "profiles") {
        const filters: Record<string, any> = {}
        const query: any = {
          select: () => query,
          eq: (column: string, value: any) => {
            filters[column] = value
            return query
          },
          maybeSingle: async () => {
            const match = state.profiles.find((p) =>
              Object.entries(filters).every(([column, value]) => p[column] === value),
            )
            if (filters.id === state.currentUser?.id) {
              return { data: { ...(match ?? {}), role: state.callerRole }, error: null }
            }
            return { data: match ?? null, error: null }
          },
        }
        return {
          ...query,
          upsert: async (row: any) => {
            if (state.profileUpsertError) return { data: null, error: state.profileUpsertError }
            state.profileUpserts.push(row)
            return { data: null, error: null }
          },
        }
      }
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { name: "Org A", business_name: "Org A Homes" },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === "permissions") {
        return {
          upsert: async (rows: any[], options?: any) => {
            state.permissionUpserts.push({ rows, options })
            return { data: null, error: null }
          },
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { supabaseAdmin: client }
})

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.currentUser }, error: null }) },
  }),
}))

vi.mock("@/lib/telnyx/credentials", () => ({
  ensureUserTelephonyCredential: vi.fn(async () => undefined),
}))

vi.mock("@/lib/email/account-emails", () => ({
  APP_URL: "https://app.test",
  resolveOrgName: async () => "Org A Homes",
  sendInviteEmail: vi.fn(async (params: any) => {
    state.emailResults.push({ kind: "invite", ...params })
    return state.inviteEmailResult
  }),
  sendAccountReadyEmail: vi.fn(async (params: any) => {
    state.emailResults.push({ kind: "account-ready", ...params })
    return state.accountReadyResult
  }),
  sendPasswordResetEmail: vi.fn(async () => ({ sent: true })),
}))

function post(body: unknown) {
  return POST(new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) }))
}

describe("create-user route", () => {
  beforeEach(() => {
    state.currentUser = { id: "admin-1" }
    state.callerRole = "admin"
    state.profiles = [
      { id: "admin-1", role: "admin", org_id: "org-A", display_name: "Ada Admin" },
      { id: "u9", role: "user", org_id: "org-A", email: "taken@test.com" },
      { id: "u8", role: "user", org_id: "org-B", email: "other@test.com" },
    ]
    state.profileUpserts = []
    state.permissionUpserts = []
    state.createUserCalls = []
    state.generateLinkCalls = []
    state.deletedUsers = []
    state.profileUpsertError = null
    state.generateLinkError = null
    state.createUserError = null
    state.hashedToken = "hashed-token-123"
    state.emailResults = []
    state.inviteEmailResult = { sent: true }
    state.accountReadyResult = { sent: true }
  })

  test("invite mode generates an invite link and mails the token URL", async () => {
    const res = await post({ email: "new@test.com", fullName: "New Person", role: "user" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(state.generateLinkCalls).toHaveLength(1)
    expect(state.generateLinkCalls[0]).toMatchObject({
      type: "invite",
      email: "new@test.com",
    })
    expect(state.createUserCalls).toHaveLength(0)
    expect(state.emailResults[0]).toMatchObject({
      kind: "invite",
      to: "new@test.com",
      inviteUrl: "https://app.test/set-password?token_hash=hashed-token-123&type=invite",
    })
    expect(body).toMatchObject({ ok: true, emailSent: true })
  })

  test("does not return the invite URL when the email sent", async () => {
    const res = await post({ email: "new@test.com", role: "user" })
    const body = await res.json()

    expect(body.emailSent).toBe(true)
    expect(body.inviteUrl).toBeUndefined()
    expect(body.emailError).toBeUndefined()
  })

  test("returns emailSent:false and the invite URL when Resend fails", async () => {
    state.inviteEmailResult = { sent: false, error: "Resend API error (401)" }

    const res = await post({ email: "new@test.com", role: "user" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.emailSent).toBe(false)
    expect(body.inviteUrl).toBe(
      "https://app.test/set-password?token_hash=hashed-token-123&type=invite",
    )
    expect(body.emailError).toBe("Resend API error (401)")
  })

  test("password mode creates the user with the supplied password", async () => {
    const res = await post({
      email: "new@test.com",
      role: "user",
      method: "password",
      password: "correct-horse-battery",
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(state.generateLinkCalls).toHaveLength(0)
    expect(state.createUserCalls[0]).toMatchObject({
      email: "new@test.com",
      password: "correct-horse-battery",
      email_confirm: true,
    })
    expect(state.emailResults[0]).toMatchObject({ kind: "account-ready" })
    // No token is ever minted for the password path.
    expect(body.inviteUrl).toBeUndefined()
  })

  test("always stamps a non-null org_id on the profile", async () => {
    await post({ email: "new@test.com", role: "user" })

    expect(state.profileUpserts).toHaveLength(1)
    expect(state.profileUpserts[0].org_id).toBe("org-A")
  })

  test("sets must_change_password per the flag in password mode", async () => {
    await post({
      email: "new@test.com",
      role: "user",
      method: "password",
      password: "correct-horse-battery",
      requirePasswordChange: false,
    })
    expect(state.profileUpserts[0].must_change_password).toBe(false)

    state.profileUpserts = []
    await post({
      email: "new2@test.com",
      role: "user",
      method: "password",
      password: "correct-horse-battery",
    })
    expect(state.profileUpserts[0].must_change_password).toBe(true)
  })

  test("rolls the auth user back when the profile upsert fails", async () => {
    state.profileUpsertError = { message: "profiles insert blew up" }

    const res = await post({ email: "new@test.com", role: "user" })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe("Could not finish creating that user.")
    expect(state.deletedUsers).toEqual(["new-user"])
  })

  test("seeds template permissions naming the unique constraint", async () => {
    await post({ email: "new@test.com", role: "user", templateId: "viewer" })

    expect(state.permissionUpserts).toHaveLength(1)
    expect(state.permissionUpserts[0].options).toEqual({
      onConflict: "user_id,permission_key",
    })
    expect(state.permissionUpserts[0].rows.every((row: any) => row.user_id === "new-user")).toBe(
      true,
    )
  })

  test("returns 409 for an email already on the team", async () => {
    const res = await post({ email: "taken@test.com", role: "user" })
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toBe("That email is already on your team.")
    expect(state.generateLinkCalls).toHaveLength(0)
  })

  test("returns 409 without disclosing another tenant", async () => {
    const res = await post({ email: "other@test.com", role: "user" })
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toBe("That email is already registered.")
  })

  test("returns 400 for a password under the minimum length", async () => {
    const res = await post({
      email: "new@test.com",
      role: "user",
      method: "password",
      password: "short",
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/at least 10 characters/)
    expect(state.createUserCalls).toHaveLength(0)
  })

  test("a guard denial short-circuits before any auth call", async () => {
    state.callerRole = "user"

    const res = await post({ email: "new@test.com", role: "user" })

    expect(res.status).toBe(403)
    expect(state.generateLinkCalls).toHaveLength(0)
    expect(state.createUserCalls).toHaveLength(0)
    expect(state.profileUpserts).toHaveLength(0)
  })
})
