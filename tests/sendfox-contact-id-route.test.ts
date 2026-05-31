import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" }, error: null }) }) }) }
      }
      if (table === "permissions") {
        const query = { eq: () => query, then: (resolve: any) => resolve({ data: [], error: null }) }
        return { select: () => query }
      }
      throw new Error(`Unexpected auth table ${table}`)
    },
  }),
}))

describe("sendfox contact id route", () => {
  test("returns 405 for permitted users", async () => {
    const { DELETE } = await import("../app/api/sendfox/contact/[id]/route")
    const req = new NextRequest("http://test", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "42" } } as any)
    expect(res.status).toBe(405)
    const body = await res.json()
    expect(body).toEqual({
      error:
        "SendFox does not support DELETE; use POST /api/sendfox/contact with Deleted list",
    })
  })
})
