import { POST } from "../../app/api/segments/resolve/route"
import type { SegmentDefinition } from "../../lib/segments/types"

const h = vi.hoisted(() => ({
  user: { id: "user-1" } as any,
  orgId: "org-1" as string | null,
  permission: true,
  ids: new Set<string>(),
  validateThrows: false,
}))

vi.mock("../../lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: h.user, orgId: h.orgId, supabase: { from: () => ({}) } }),
}))
vi.mock("../../lib/permissions/server", () => ({
  hasPermission: async () => h.permission,
}))
vi.mock("../../lib/segments/resolver", () => ({
  resolveSegment: async () => h.ids,
  validateDefinition: () => {
    if (h.validateThrows) throw new Error("Unknown attribute field: bogus")
  },
}))

const DEF: SegmentDefinition = { match: "all", conditions: [] }

function req(body: any) {
  return new Request("http://test/api/segments/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("/api/segments/resolve", () => {
  beforeEach(() => {
    h.user = { id: "user-1" }
    h.orgId = "org-1"
    h.permission = true
    h.ids = new Set<string>()
    h.validateThrows = false
  })

  test("valid definition returns buyerIds and a matching count", async () => {
    h.ids = new Set(["a", "b", "c"])
    const res = await POST(req({ definition: DEF, channel: "email" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.buyerIds.sort()).toEqual(["a", "b", "c"])
    expect(body.count).toBe(3)
    expect(body.count).toBe(body.buyerIds.length)
  })

  test("malformed definition returns 400 (never 500)", async () => {
    h.validateThrows = true
    const res = await POST(req({ definition: { match: "all", conditions: [{ kind: "attribute", field: "bogus" }] }, channel: "sms" }))
    expect(res.status).toBe(400)
  })

  test("unauthorized returns 401", async () => {
    h.user = null
    const res = await POST(req({ definition: DEF, channel: "email" }))
    expect(res.status).toBe(401)
  })

  test("missing channel returns 400", async () => {
    const res = await POST(req({ definition: DEF }))
    expect(res.status).toBe(400)
  })

  test("forbidden returns 403", async () => {
    h.permission = false
    const res = await POST(req({ definition: DEF, channel: "email" }))
    expect(res.status).toBe(403)
  })
})
