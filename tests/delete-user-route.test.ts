import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/delete-user/route"
vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

let deleted: string[] = []
let profilesDeleted: string[] = []

// Caller "a" and target "u1" share org-A; "u2" lives in a different org.
const orgByUserId: Record<string, string> = { a: "org-A", u1: "org-A", u2: "org-B" }

vi.mock("../lib/supabase", () => {
  const client = {
    auth: {
      admin: {
        deleteUser: vi.fn(async (id: string) => {
          deleted.push(id)
          return { error: null }
        }),
      },
    },
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`Unexpected table ${table}`)
      return {
        select: () => ({
          eq: (_column: string, id: string) => ({
            maybeSingle: async () => {
              const org = orgByUserId[id]
              return { data: org ? { org_id: org } : null, error: null }
            },
          }),
        }),
        delete: () => ({
          eq: async (_column: string, id: string) => {
            profilesDeleted.push(id)
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
    auth: { getUser: async () => ({ data: { user: { id: "a" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" }, error: null }) }) }) }),
  }),
}))

describe("delete-user route", () => {
  beforeEach(() => {
    deleted = []
    profilesDeleted = []
  })

  test("deletes a same-org user", async () => {
    const req = new NextRequest("http://t", { method: "POST", body: JSON.stringify({ userId: "u1" }) })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(deleted).toContain("u1")
  })

  test("refuses to delete a user in another org", async () => {
    const req = new NextRequest("http://t", { method: "POST", body: JSON.stringify({ userId: "u2" }) })
    const res = await POST(req)
    expect(res.status).toBe(403)
    expect(deleted).not.toContain("u2")
    expect(profilesDeleted).not.toContain("u2")
  })
})
