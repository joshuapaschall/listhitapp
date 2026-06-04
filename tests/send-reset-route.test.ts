import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/send-reset/route"
vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

let resets: string[] = []

// Caller "a" is in org-A. a@test.com is same-org; b@other.com is in org-B.
const orgByUserId: Record<string, string> = { a: "org-A" }
const orgByEmail: Record<string, string> = { "a@test.com": "org-A", "b@other.com": "org-B" }

// profiles is queried two ways: by id (resolveOrgIdForUser) and by email+org_id
// (the route's same-org target lookup). This chainable mock models both.
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
        const org = orgByUserId[filters.id]
        return { data: org ? { org_id: org } : null, error: null }
      }
      if (filters.email !== undefined) {
        const org = orgByEmail[filters.email]
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
        resetPasswordForEmail: vi.fn(async (email: string) => {
          resets.push(email)
          return { error: null }
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
    auth: { getUser: async () => ({ data: { user: { id: "a" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" }, error: null }) }) }) }),
  }),
}))

describe("send-reset route", () => {
  beforeEach(() => { resets = [] })

  test("sends a reset to a same-org user", async () => {
    const req = new NextRequest("http://t", { method: "POST", body: JSON.stringify({ email: "a@test.com" }) })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(resets).toContain("a@test.com")
  })

  test("returns 404 for an email in another org", async () => {
    const req = new NextRequest("http://t", { method: "POST", body: JSON.stringify({ email: "b@other.com" }) })
    const res = await POST(req)
    expect(res.status).toBe(404)
    expect(resets).not.toContain("b@other.com")
  })
})
