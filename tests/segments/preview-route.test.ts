import { POST } from "../../app/api/segments/preview/route"
import type { SegmentDefinition } from "../../lib/segments/types"

const h = vi.hoisted(() => ({
  user: { id: "user-1" } as any,
  orgId: "org-1" as string | null,
  permission: true,
  count: 0,
  validateThrows: false,
  contextThrows: false,
}))

vi.mock("../../lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: h.user, orgId: h.orgId, supabase: { from: () => ({}) } }),
}))
vi.mock("../../lib/permissions/server", () => ({
  hasPermission: async () => h.permission,
}))
vi.mock("../../lib/segments/resolver", () => {
  class SegmentContextError extends Error {}
  return {
    SegmentContextError,
    countSegment: async () => {
      if (h.contextThrows) throw new SegmentContextError("This segment targets the current campaign and can only be previewed inside a campaign.")
      return h.count
    },
    resolveSegment: async () => {
      if (h.contextThrows) throw new SegmentContextError("This segment targets the current campaign and can only be previewed inside a campaign.")
      return new Set<string>()
    },
    validateDefinition: () => {
      if (h.validateThrows) throw new Error("Unknown attribute field: bogus")
    },
  }
})

const DEF: SegmentDefinition = { match: "all", conditions: [] }

function req(body: any) {
  return new Request("http://test/api/segments/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("/api/segments/preview", () => {
  beforeEach(() => {
    h.user = { id: "user-1" }
    h.orgId = "org-1"
    h.permission = true
    h.count = 0
    h.validateThrows = false
    h.contextThrows = false
  })

  test("valid definition returns the count", async () => {
    h.count = 137
    const res = await POST(req({ definition: DEF, channel: "email" }))
    expect(res.status).toBe(200)
    expect((await res.json()).count).toBe(137)
  })

  test("malformed definition returns 400 (never 500)", async () => {
    h.validateThrows = true
    const res = await POST(req({ definition: { match: "all", conditions: [{ kind: "attribute", field: "bogus" }] }, channel: "email" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Unknown attribute field/)
  })

  test("this_campaign context errors return 400 instead of 500", async () => {
    h.contextThrows = true
    const res = await POST(req({ definition: DEF, channel: "email" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/current campaign/)
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
    const res = await POST(req({ definition: DEF, channel: "sms" }))
    expect(res.status).toBe(403)
  })
})
