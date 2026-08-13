import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/send-reset/route"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "a" } as { id: string } | null,
  callerRole: "admin",
  // Caller "a" is in org-A. a@test.com is same-org; b@other.com is in org-B.
  orgByUserId: { a: "org-A" } as Record<string, string>,
  orgByEmail: { "a@test.com": "org-A", "b@other.com": "org-B" } as Record<string, string>,
  generateLinkCalls: [] as any[],
  emailCalls: [] as any[],
  emailResult: { sent: true } as { sent: boolean; error?: string },
}))

// profiles is queried two ways: by id (requireOrgAdmin + resolveOrgIdForUser)
// and by email+org_id (the route's same-org target lookup).
function profilesQuery() {
  const filters: Record<string, any> = {}
  const q: any = {
    select: () => q,
    eq: (col: string, val: any) => {
      filters[col] = val
      return q
    },
    maybeSingle: async () => {
      if (filters.id !== undefined) {
        const org = state.orgByUserId[filters.id]
        if (!org) return { data: null, error: null }
        return { data: { role: state.callerRole, org_id: org }, error: null }
      }
      if (filters.email !== undefined) {
        const org = state.orgByEmail[filters.email]
        // The route filters by both email AND org_id, so only a same-org match returns a row.
        if (org && org === filters.org_id) return { data: { org_id: org }, error: null }
        return { data: null, error: null }
      }
      return { data: null, error: null }
    },
  }
  return q
}

vi.mock("../lib/supabase", () => {
  const client = {
    auth: {
      admin: {
        // NOT resetPasswordForEmail — that method does not exist on
        // GoTrueAdminApi, and mocking it is what let the broken call ship.
        generateLink: vi.fn(async (params: any) => {
          state.generateLinkCalls.push(params)
          return {
            data: { properties: { hashed_token: "recovery-token-abc" } },
            error: null,
          }
        }),
      },
    },
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`Unexpected table ${table}`)
      return profilesQuery()
    },
  }
  return { supabaseAdmin: client }
})

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.currentUser }, error: null }) },
  }),
}))

vi.mock("@/lib/email/account-emails", () => ({
  APP_URL: "https://app.test",
  resolveOrgName: async () => "Org A Homes",
  sendPasswordResetEmail: vi.fn(async (params: any) => {
    state.emailCalls.push(params)
    return state.emailResult
  }),
  sendInviteEmail: vi.fn(async () => ({ sent: true })),
  sendAccountReadyEmail: vi.fn(async () => ({ sent: true })),
}))

function post(body: unknown) {
  return POST(new NextRequest("http://t", { method: "POST", body: JSON.stringify(body) }))
}

describe("send-reset route", () => {
  beforeEach(() => {
    state.currentUser = { id: "a" }
    state.callerRole = "admin"
    state.generateLinkCalls = []
    state.emailCalls = []
    state.emailResult = { sent: true }
  })

  test("generates a recovery link and emails it to a same-org user", async () => {
    const res = await post({ email: "a@test.com" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(state.generateLinkCalls[0]).toMatchObject({
      type: "recovery",
      email: "a@test.com",
    })
    expect(state.emailCalls[0]).toMatchObject({
      to: "a@test.com",
      resetUrl: "https://app.test/set-password?token_hash=recovery-token-abc&type=recovery",
    })
    expect(body).toMatchObject({ ok: true, emailSent: true })
  })

  test("does not return the reset URL when the email sent", async () => {
    const res = await post({ email: "a@test.com" })
    const body = await res.json()

    // A recovery token is an account-takeover credential — it must not sit in a
    // success body that nothing reads.
    expect(body.emailSent).toBe(true)
    expect(body.resetUrl).toBeUndefined()
    expect(body.emailError).toBeUndefined()
  })

  test("returns the reset URL when the email failed", async () => {
    state.emailResult = { sent: false, error: "RESEND_API_KEY not configured" }

    const res = await post({ email: "a@test.com" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.emailSent).toBe(false)
    expect(body.resetUrl).toBe(
      "https://app.test/set-password?token_hash=recovery-token-abc&type=recovery",
    )
    expect(body.emailError).toBe("RESEND_API_KEY not configured")
  })

  test("returns 404 for an email in another org", async () => {
    const res = await post({ email: "b@other.com" })

    expect(res.status).toBe(404)
    expect(state.generateLinkCalls).toEqual([])
    expect(state.emailCalls).toEqual([])
  })

  test("rejects a non-admin caller", async () => {
    state.callerRole = "user"

    const res = await post({ email: "a@test.com" })

    expect(res.status).toBe(403)
    expect(state.generateLinkCalls).toEqual([])
  })
})
