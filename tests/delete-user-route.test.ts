import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/delete-user/route"
vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

let deleted: string[] = []

vi.mock("../lib/supabase", () => {
  const client = {
    auth: { admin: { deleteUser: vi.fn(async (id: string) => { deleted.push(id); return { error: null } }) } },
    from: () => ({ delete: () => ({ eq: async () => ({ error: null }) }) }),
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
  beforeEach(() => { deleted = [] })
  test("deletes", async () => {
    const req = new NextRequest("http://t", { method: "POST", body: JSON.stringify({ userId: "u1" }) })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(deleted).toContain("u1")
  })
})
