import { NextRequest } from "next/server"

const h = vi.hoisted(() => {
  const state = {
    eqCalls: [] as [string, unknown][],
    campaignEqCalls: [] as [string, unknown][],
    campaigns: [] as any[],
    insertedCampaigns: [] as any[],
    authUser: { id: "user-1" } as any,
    orgId: "org-1" as string | null,
    fetchMock: vi.fn(),
  }

  function chainable(getRows: () => any[], table?: string) {
    let rows = getRows()
    const query: any = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        state.eqCalls.push([column, value])
        if (table === "campaigns") state.campaignEqCalls.push([column, value])
        rows = rows.filter((row) => row?.[column] === value)
        return query
      },
      in: () => query,
      limit: () => query,
      order: async () => ({ data: rows, error: null }),
      update: () => query,
      delete: () => query,
      maybeSingle: async () => ({ data: rows[0] || null, error: null }),
      single: async () => ({ data: rows[0] || null, error: null }),
      then: (resolve: any) => resolve({ data: rows, error: null }),
    }
    return query
  }

  const client: any = {
    auth: {
      getUser: async () => ({ data: { user: state.authUser }, error: null }),
    },
    rpc: async () => ({ data: [], error: null }),
    from: (table: string) => {
      if (table === "campaigns") {
        return {
          select: () => chainable(() => state.campaigns, "campaigns"),
          update: () => chainable(() => state.campaigns, "campaigns"),
          delete: () => chainable(() => state.campaigns, "campaigns"),
          insert: (payload: any) => {
            state.insertedCampaigns.push(payload)
            return chainable(() => [payload], "campaigns")
          },
        }
      }
      if (table === "campaign_recipients") {
        return {
          select: () => chainable(() => []),
          update: () => chainable(() => []),
          delete: () => chainable(() => []),
        }
      }
      if (table === "email_campaign_queue" || table === "sms_campaign_queue") {
        return { delete: () => chainable(() => []) }
      }
      if (table === "email_events") {
        return { select: () => chainable(() => []) }
      }
      if (table === "profiles") {
        return { select: () => chainable(() => [{ id: state.authUser?.id, role: "user" }]) }
      }
      if (table === "permissions") {
        return {
          select: () => chainable(() => [
            { user_id: state.authUser?.id, permission_key: "campaigns.send_sms", granted: true },
            { user_id: state.authUser?.id, permission_key: "campaigns.send_email", granted: true },
          ]),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }

  return { state, client }
})

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.client, supabase: h.client }))
vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: h.state.authUser, orgId: h.state.orgId, supabase: h.client }),
  resolveOrgIdForUser: async () => h.state.orgId,
}))
vi.mock("@/services/email-metrics-service", () => ({
  getEmailCampaignCostMetrics: vi.fn(async () => ({ totalCostUsd: 0 })),
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
    h.state.campaignEqCalls = []
    h.state.campaigns = []
    h.state.insertedCampaigns = []
    h.state.authUser = { id: "user-1" }
    h.state.orgId = "org-1"
    h.state.fetchMock.mockReset().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () => "{}",
    })
    ;(global as any).fetch = h.state.fetchMock
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

    expect(h.state.campaignEqCalls).toContainEqual(["org_id", "org-1"])
    expect(h.state.campaignEqCalls).not.toContainEqual(["user_id", "user-1"])
  })

  test("resume route campaign lookup filters by org_id instead of user_id", async () => {
    h.state.campaigns = [{ id: "campaign-1", org_id: "org-1", user_id: "creator-1", channel: "sms", status: "processing" }]
    const { POST } = await import("../app/api/campaigns/[id]/resume/route")
    const request = new NextRequest("http://test/api/campaigns/campaign-1/resume", {
      method: "POST",
      headers: { Authorization: "Bearer aaa.bbb.ccc" },
    })

    await POST(request, { params: { id: "campaign-1" } })

    expect(h.state.campaignEqCalls).toContainEqual(["org_id", "org-1"])
    expect(h.state.campaignEqCalls).not.toContainEqual(["user_id", "user-1"])
  })

  test("analytics route campaign lookup filters by org_id instead of user_id", async () => {
    h.state.campaigns = [{ id: "campaign-1", org_id: "org-1", user_id: "creator-1", channel: "email" }]
    const { GET } = await import("../app/api/campaigns/[id]/analytics/route")
    const request = new NextRequest("http://test/api/campaigns/campaign-1/analytics")

    await GET(request, { params: { id: "campaign-1" } })

    expect(h.state.campaignEqCalls).toContainEqual(["org_id", "org-1"])
    expect(h.state.campaignEqCalls).not.toContainEqual(["user_id", "user-1"])
  })

  test("send-now route campaign lookup filters by org_id instead of user_id", async () => {
    h.state.campaigns = [{ id: "campaign-1", org_id: "org-1", user_id: "creator-1", channel: "sms" }]
    const { POST } = await import("../app/api/campaigns/send-now/route")
    const request = new NextRequest("http://test/api/campaigns/send-now", {
      method: "POST",
      body: JSON.stringify({ campaignId: "campaign-1" }),
    })

    await POST(request)

    expect(h.state.campaignEqCalls).toContainEqual(["org_id", "org-1"])
    expect(h.state.campaignEqCalls).not.toContainEqual(["user_id", "user-1"])
  })

  test("duplicate route scopes source campaign by org_id and stamps org_id on insert", async () => {
    h.state.campaigns = [{ id: "campaign-1", org_id: "org-1", user_id: "creator-1", channel: "sms", name: "Campaign" }]
    const { POST } = await import("../app/api/campaigns/[id]/duplicate/route")
    const request = new NextRequest("http://test/api/campaigns/campaign-1/duplicate", { method: "POST" })

    await POST(request, { params: { id: "campaign-1" } })

    expect(h.state.campaignEqCalls).toContainEqual(["org_id", "org-1"])
    expect(h.state.campaignEqCalls).not.toContainEqual(["user_id", "user-1"])
    expect(h.state.insertedCampaigns[0]).toMatchObject({ org_id: "org-1", user_id: "user-1" })
  })

  test("delete route campaign lookup filters by org_id instead of owner user_id", async () => {
    h.state.campaigns = [{ id: "campaign-1", org_id: "org-1", user_id: "creator-1", channel: "sms" }]
    const { POST } = await import("../app/api/campaigns/delete/route")
    const request = new NextRequest("http://test/api/campaigns/delete", {
      method: "POST",
      body: JSON.stringify({ campaignId: "campaign-1" }),
    })

    await POST(request)

    expect(h.state.campaignEqCalls).toContainEqual(["org_id", "org-1"])
    expect(h.state.campaignEqCalls).not.toContainEqual(["user_id", "user-1"])
  })
})
