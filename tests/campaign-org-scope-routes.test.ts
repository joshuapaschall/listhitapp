import { NextRequest } from "next/server"

const h = vi.hoisted(() => {
  const state = {
    eqCalls: [] as [string, unknown][],
    campaigns: [] as any[],
    authUser: { id: "user-1" } as any,
    orgId: "org-1" as string | null,
  }

  function chainable(getRows: () => any[]) {
    let rows = getRows()
    const query: any = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        state.eqCalls.push([column, value])
        rows = rows.filter((row) => row?.[column] === value)
        return query
      },
      update: () => query,
      maybeSingle: async () => ({ data: rows[0] || null, error: null }),
      single: async () => ({ data: rows[0] || null, error: null }),
    }
    return query
  }

  const client: any = {
    auth: {
      getUser: async () => ({ data: { user: state.authUser }, error: null }),
    },
    from: (table: string) => {
      if (table === "campaigns") {
        return {
          select: () => chainable(() => state.campaigns),
          update: () => chainable(() => state.campaigns),
        }
      }
      if (table === "campaign_recipients") {
        return { update: () => chainable(() => []) }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }

  return { state, client }
})

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.client, supabase: h.client }))
vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ orgId: h.state.orgId }),
  resolveOrgIdForUser: async () => h.state.orgId,
}))
vi.mock("@/services/sms-campaign-sender", () => ({
  queueSmsCampaign: vi.fn(async () => ({})),
  processSmsQueue: vi.fn(async () => 0),
}))
vi.mock("@/services/campaign-sender", () => ({
  queueEmailCampaign: vi.fn(async () => ({})),
  processEmailQueue: vi.fn(async () => 0),
  sendEmailCampaign: vi.fn(async () => "email-1"),
}))
vi.mock("@/services/shortlink-service", () => ({
  createShortLinksBulk: vi.fn(async () => []),
  createShortLink: vi.fn(async () => null),
}))
vi.mock("@/lib/email-sender-resolver", () => ({
  SenderNotVerifiedError: class SenderNotVerifiedError extends Error {},
  resolveCampaignSender: vi.fn(async () => ({
    fromEmail: "from@test.com",
    fromName: "Test",
    replyTo: "reply@test.com",
  })),
}))
vi.mock("@/lib/notifications", () => ({
  insertNotification: vi.fn(async () => ({})),
}))

describe("campaign org ownership scoping", () => {
  beforeEach(() => {
    vi.resetModules()
    h.state.eqCalls = []
    h.state.campaigns = []
    h.state.authUser = { id: "user-1" }
    h.state.orgId = "org-1"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://local"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc"
    process.env.CRON_SECRET = "cron"
  })

  test("send route campaign lookup filters by org_id instead of user_id", async () => {
    h.state.campaigns = [{ id: "campaign-1", org_id: "org-1", user_id: "creator-1", channel: "sms", message: "" }]
    const { POST } = await import("../app/api/campaigns/send/route")
    const request = new NextRequest("http://test/api/campaigns/send", {
      method: "POST",
      headers: { Authorization: "Bearer aaa.bbb.ccc" },
      body: JSON.stringify({ campaignId: "campaign-1" }),
    })

    await POST(request)

    expect(h.state.eqCalls).toContainEqual(["org_id", "org-1"])
    expect(h.state.eqCalls).not.toContainEqual(["user_id", "user-1"])
  })

  test("resume route campaign lookup filters by org_id instead of user_id", async () => {
    h.state.campaigns = [{ id: "campaign-1", org_id: "org-1", user_id: "creator-1", channel: "sms", status: "processing" }]
    const { POST } = await import("../app/api/campaigns/[id]/resume/route")
    const request = new NextRequest("http://test/api/campaigns/campaign-1/resume", {
      method: "POST",
      headers: { Authorization: "Bearer aaa.bbb.ccc" },
    })

    await POST(request, { params: { id: "campaign-1" } })

    expect(h.state.eqCalls).toContainEqual(["org_id", "org-1"])
    expect(h.state.eqCalls).not.toContainEqual(["user_id", "user-1"])
  })
})
