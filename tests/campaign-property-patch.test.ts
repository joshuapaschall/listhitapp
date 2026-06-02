import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  updatePayload: null as Record<string, unknown> | null,
}))

function createQuery(table: string) {
  const query: any = {
    select: () => query,
    eq: () => query,
    update: (payload: Record<string, unknown>) => {
      state.updatePayload = payload
      return query
    },
    maybeSingle: async () => ({ data: { id: "campaign-1", status: "draft", user_id: "user-1" }, error: null }),
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

vi.mock("@/lib/permissions/server", () => ({
  hasPermission: vi.fn(async () => true),
}))

describe("campaign property attribution PATCH", () => {
  beforeEach(() => {
    vi.resetModules()
    state.updatePayload = null
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
})
