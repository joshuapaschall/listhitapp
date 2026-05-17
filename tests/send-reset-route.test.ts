import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/send-reset/route"
vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

let resets: string[] = []

vi.mock("../lib/supabase", () => {
  const client = {
    auth: { admin: { resetPasswordForEmail: vi.fn(async (email: string) => { resets.push(email); return { error: null } }) } },
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
  test("sends", async () => {
    const req = new NextRequest("http://t", { method: "POST", body: JSON.stringify({ email: "a@test.com" }) })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(resets).toContain("a@test.com")
  })
})
