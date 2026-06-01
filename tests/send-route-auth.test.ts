import { NextRequest } from "next/server"
import { POST } from "../app/api/campaigns/send/route"
import { POST as SendfoxPOST } from "../app/api/sendfox/contact/route"

// Shared, mutable state the mocked modules read. Defined via vi.hoisted so the
// hoisted vi.mock factories can reference it, while test bodies mutate it.
const h = vi.hoisted(() => {
  const state: any = {
    campaigns: [] as any[],
    recipients: [] as any[],
    buyers: [] as any[],
    buyerGroups: [] as any[],
    authUser: null as any,
    sfUser: null as any,
    recipientCounter: 1,
  }

  const nested = (row: any, col: string) => {
    if (col.includes(".")) {
      const [a, b] = col.split(".")
      return row?.[a]?.[b]
    }
    return row?.[col]
  }

  function chainable(getRows: () => any[]) {
    let rows = getRows()
    const q: any = {
      eq: (col: string, val: any) => {
        rows = rows.filter((r) => nested(r, col) === val)
        return q
      },
      in: (col: string, vals: any[]) => {
        rows = rows.filter((r) => vals.includes(nested(r, col)))
        return q
      },
      is: (col: string, val: any) => {
        rows = rows.filter((r) => nested(r, col) === val)
        return q
      },
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: rows[0] || null, error: null }),
      single: async () => ({ data: rows[0] || null, error: null }),
      then: (resolve: any) => resolve({ data: rows, error: null }),
    }
    return q
  }

  const recipientsWithBuyers = () =>
    state.recipients.map((r: any) => ({
      ...r,
      buyers: r.buyers || state.buyers.find((b: any) => b.id === r.buyer_id),
    }))

  const client: any = {
    from: (table: string) => {
      if (table === "campaigns") {
        return {
          select: () => chainable(() => state.campaigns),
          update: () => ({ eq: async () => ({ error: null }), in: async () => ({ error: null }) }),
        }
      }
      if (table === "buyer_groups") {
        return { select: () => chainable(() => state.buyerGroups) }
      }
      if (table === "buyers") {
        return {
          select: () => chainable(() => state.buyers),
          update: () => ({ eq: async () => ({ error: null }), in: async () => ({ error: null }) }),
        }
      }
      if (table === "campaign_recipients") {
        return {
          select: () => chainable(recipientsWithBuyers),
          insert: async (rows: any[]) => {
            rows.forEach((r) =>
              state.recipients.push({
                id: `r${state.recipientCounter++}`,
                ...r,
                buyers: state.buyers.find((b: any) => b.id === r.buyer_id),
              }),
            )
            return { error: null }
          },
          delete: () => ({
            eq: async (col: string, val: any) => {
              state.recipients = state.recipients.filter((r: any) => r[col] !== val)
              return { error: null }
            },
          }),
          update: () => ({ eq: async () => ({ error: null }), in: async () => ({ error: null }) }),
        }
      }
      if (table === "buyer_sms_senders") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
      }
      if (table === "buyer_list_consent") {
        return {
          upsert: async () => ({ error: null }),
          select: () => chainable(() => []),
          update: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
    auth: {
      getUser: async () => ({ data: { user: state.authUser }, error: null }),
    },
  }

  return { state, client }
})

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.client, supabase: h.client }))

vi.mock("@/services/sms-campaign-sender", () => ({
  queueSmsCampaign: vi.fn(async () => ({})),
  processSmsQueue: vi.fn(async () => 0),
}))
vi.mock("@/services/campaign-sender", () => ({
  queueEmailCampaign: vi.fn(async () => ({})),
  processEmailQueue: vi.fn(async () => 0),
  sendEmailCampaign: vi.fn(async () => "e1"),
}))
vi.mock("@/services/shortlink-service", () => ({
  createShortLinksBulk: vi.fn(async () => []),
  createShortLink: vi.fn(async () => null),
}))

// Sendfox-contact dependencies (cookie auth + sendfox context).
vi.mock("next/headers", () => ({ cookies: () => ({}) }))
vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: h.state.sfUser }, error: null }) },
  }),
}))
vi.mock("@/lib/permissions/server", () => ({
  requirePermission: async () => null,
}))
vi.mock("@/services/sendfox-auth", () => ({
  getDefaultSendfoxContext: () =>
    process.env.SENDFOX_API_TOKEN || process.env.SENDFOX_API_KEY
      ? { accessToken: "x", source: "env" }
      : null,
  getSendfoxIntegration: async () => null,
  buildSendfoxContextFromIntegration: (i: any) => i,
  withSendfoxAuth: async (_ctx: any, fn: any) => fn(),
}))
vi.mock("@/services/sendfox-service", () => ({
  upsertContact: vi.fn(async () => ({ id: 1 })),
}))

let smsSender: any

describe("send route auth", () => {
  beforeEach(async () => {
    h.state.campaigns = []
    h.state.recipients = []
    h.state.buyers = []
    h.state.buyerGroups = []
    h.state.authUser = null
    h.state.recipientCounter = 1
    process.env.SUPABASE_URL = "http://local"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc"
    process.env.CRON_SECRET = "cron"
    process.env.TELNYX_MESSAGING_PROFILE_ID = "mp1"
    process.env.AWS_SES_FROM_EMAIL = "from@test.com"
    smsSender = await import("@/services/sms-campaign-sender")
    ;(smsSender.queueSmsCampaign as any).mockClear()
  })

  test("returns 404 when user not owner (ownership enforced by query scope)", async () => {
    h.state.campaigns.push({ id: "c1", user_id: "u1", channel: "sms", message: "Hi", buyer_ids: ["b1"] })
    h.state.buyers.push({ id: "b1", phone: "+15125550111", can_receive_sms: true, deleted_at: null, sendfox_suppressed: false })
    h.state.authUser = { id: "u2" }
    const req = new NextRequest("http://test", {
      method: "POST",
      headers: { Authorization: "Bearer aaa.bbb.ccc" },
      body: JSON.stringify({ campaignId: "c1" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  test("allows owner token and queues the SMS campaign", async () => {
    h.state.campaigns.push({ id: "c2", user_id: "u2", channel: "sms", message: "Yo", buyer_ids: ["b2"] })
    h.state.buyers.push({ id: "b2", phone: "+15125550123", can_receive_sms: true, deleted_at: null, sendfox_suppressed: false })
    h.state.authUser = { id: "u2" }
    const req = new NextRequest("http://test", {
      method: "POST",
      headers: { Authorization: "Bearer aaa.bbb.ccc" },
      body: JSON.stringify({ campaignId: "c2" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(smsSender.queueSmsCampaign).toHaveBeenCalled()
  })
})

describe("sendfox contact auth", () => {
  beforeEach(() => {
    h.state.buyers = []
    h.state.sfUser = null
  })

  test("returns 401 when unauthenticated", async () => {
    h.state.sfUser = null
    delete process.env.SENDFOX_API_TOKEN
    delete process.env.SENDFOX_API_KEY
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ email: "x@test.com", lists: [] }),
    })
    const res = await SendfoxPOST(req)
    expect(res.status).toBe(401)
  })

  test("accepts fallback key", async () => {
    h.state.sfUser = { id: "u1" }
    delete process.env.SENDFOX_API_TOKEN
    process.env.SENDFOX_API_KEY = "old"
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ email: "x@test.com", lists: [] }),
    })
    const res = await SendfoxPOST(req)
    expect(res.status).toBe(200)
  })
})
