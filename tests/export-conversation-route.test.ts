import { NextRequest } from "next/server"
import { GET } from "../app/api/export-conversation/[buyerId]/route"

const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  orgId: "org-1" as string | null,
  messages: [] as any[],
}))

function buildSupabase() {
  return {
    from: (table: string) => {
      if (table === "buyers") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "b1" }, error: null }),
            }),
          }),
        }
      }

      if (table === "messages") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                order: async () => ({ data: state.messages, error: null }),
              }),
            }),
          }),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
  }
}

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({
    user: state.user,
    orgId: state.orgId,
    supabase: buildSupabase(),
  }),
}))

describe("export conversation route", () => {
  beforeEach(() => {
    state.user = { id: "user-1" }
    state.orgId = "org-1"
    state.messages = [
      { id: "m1", buyer_id: "b1", created_at: "2025", direction: "outbound" },
    ]
  })

  test("returns csv", async () => {
    const req = new NextRequest("http://test?format=csv")
    const res = await GET(req, { params: { buyerId: "b1" } })
    const text = await res.text()
    expect(text).toContain("outbound")
    expect(res.headers.get("Content-Type")).toBe("text/csv")
  })

  test("returns json by default", async () => {
    const req = new NextRequest("http://test")
    const res = await GET(req, { params: { buyerId: "b1" } })
    const text = await res.text()
    expect(text).toContain("outbound")
    expect(res.headers.get("Content-Type")).toBe("application/json")
  })

  test("returns 401 without a session", async () => {
    state.user = null
    state.orgId = null
    const req = new NextRequest("http://test")
    const res = await GET(req, { params: { buyerId: "b1" } })
    expect(res.status).toBe(401)
  })
})
