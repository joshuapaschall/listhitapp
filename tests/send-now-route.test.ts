import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  campaigns: [{ id: "c1", user_id: "user-1", channel: "sms" }] as any[],
  permissions: [{ permission_key: "campaigns.send_sms", granted: true }] as any[],
  fetchMock: vi.fn(),
}))

function createRouteClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { role: "user" }, error: null }) }),
          }),
        }
      }
      if (table === "permissions") {
        const query = {
          eq: () => query,
          then: (resolve: any) => resolve({ data: state.permissions, error: null }),
        }
        return { select: () => query }
      }
      if (table === "campaigns") {
        return {
          select: () => ({
            eq: (_column: string, id: string) => ({
              maybeSingle: async () => ({ data: state.campaigns.find((campaign) => campaign.id === id) ?? null, error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
}

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => createRouteClient(),
}))

describe("send-now route", () => {
  beforeEach(() => {
    vi.resetModules()
    state.fetchMock.mockReset().mockResolvedValue({ status: 200, text: async () => "{}" })
    ;(global as any).fetch = state.fetchMock
    process.env.DISPOTOOL_BASE_URL = ""
    process.env.SITE_URL = ""
    process.env.CRON_SECRET = "tok"
  })

  async function postSendNow(url: string) {
    const { POST } = await import("../app/api/campaigns/send-now/route")
    const req = new NextRequest(url, {
      method: "POST",
      body: JSON.stringify({ campaignId: "c1" }),
      headers: { "Content-Type": "application/json" },
    })
    return POST(req)
  }

  test("adds Authorization header", async () => {
    await postSendNow("http://test")

    expect(state.fetchMock).toHaveBeenCalledWith(
      "http://test/api/campaigns/send",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer tok",
        }),
      }),
    )
  })

  test("falls back to request origin", async () => {
    await postSendNow("http://origin")

    expect(state.fetchMock).toHaveBeenCalledWith(
      "http://origin/api/campaigns/send",
      expect.anything(),
    )
  })
})
