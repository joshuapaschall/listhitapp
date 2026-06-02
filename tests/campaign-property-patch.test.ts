import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  updatePayload: null as Record<string, unknown> | null,
  eqCalls: [] as [string, unknown][],
}))

function createQuery(table: string) {
  const query: any = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      state.eqCalls.push([column, value])
      return query
    },
    update: (payload: Record<string, unknown>) => {
      state.updatePayload = payload
      return query
    },
    maybeSingle: async () => ({ data: { id: "campaign-1", status: "draft", user_id: "user-1", org_id: "org-1" }, error: null }),
    single: async () => ({ data: { id: "campaign-1", ...state.updatePayload }, error: null }),
  }
  return query
}

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: (table: string) => createQuery(table),
  }),
}))

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({
    user: { id: "user-1" },
    orgId: "org-1",
    supabase: {
      from: (table: string) => createQuery(table),
    },
  }),
}))

vi.mock("@/lib/permissions/server", () => ({
  hasPermission: vi.fn(async () => true),
}))

describe("campaign property attribution PATCH", () => {
  beforeEach(() => {
    vi.resetModules()
    state.updatePayload = null
    state.eqCalls = []
  })

  test("persists property_id through the allowlist", async () => {
    const { PATCH } = await import("../app/api/campaigns/[id]/route")
    const request = new NextRequest("http://test/api/campaigns/campaign-1", {
      method: "PATCH",
      body: JSON.stringify({ property_id: "property-1", name: "ROI Campaign", ignored: "nope" }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await PATCH(request, { params: { id: "campaign-1" } })

    expect(response.status).toBe(200)
    expect(state.updatePayload).toEqual(expect.objectContaining({
      property_id: "property-1",
      name: "ROI Campaign",
    }))
    expect(state.updatePayload).not.toHaveProperty("ignored")
  })

  test("scopes the campaign lookup by org_id instead of user_id", async () => {
    const { PATCH } = await import("../app/api/campaigns/[id]/route")
    const request = new NextRequest("http://test/api/campaigns/campaign-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "ROI Campaign" }),
      headers: { "Content-Type": "application/json" },
    })

    const response = await PATCH(request, { params: { id: "campaign-1" } })

    expect(response.status).toBe(200)
    expect(state.eqCalls).toContainEqual(["org_id", "org-1"])
    expect(state.eqCalls).not.toContainEqual(["user_id", "user-1"])
  })
})
