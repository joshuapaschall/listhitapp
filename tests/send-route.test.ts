import { NextRequest } from "next/server"
import { POST } from "../app/api/campaigns/send/route"

// Shared mutable state the mocked @/lib/supabase reads. vi.hoisted so the
// hoisted vi.mock factory can reference the stable client object.
const h = vi.hoisted(() => {
  const state: any = {
    campaigns: [] as any[],
    recipients: [] as any[],
    buyers: [] as any[],
    buyerGroups: [] as any[],
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
  const groupsWithBuyers = () =>
    state.buyerGroups.map((g: any) => ({
      ...g,
      buyers: state.buyers.find((b: any) => b.id === g.buyer_id),
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
        return { select: () => chainable(groupsWithBuyers) }
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
      throw new Error(`Unexpected table ${table}`)
    },
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
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
  // Return one short link per requested input, echoing slug from the target.
  createShortLinksBulk: vi.fn(async (inputs: any[]) =>
    inputs.map((_: any, i: number) => ({ shortUrl: `https://s.io/${i}`, slug: `s${i}` })),
  ),
  createShortLink: vi.fn(async () => null),
}))

// Email-path dependencies
vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ orgId: "o1" }),
  resolveOrgIdForUser: async () => "o1",
}))
vi.mock("@/lib/email-sender-resolver", () => ({
  SenderNotVerifiedError: class SenderNotVerifiedError extends Error {},
  resolveCampaignSender: async () => ({
    fromEmail: "from@test.com",
    fromName: "Test",
    replyTo: "reply@test.com",
  }),
}))
vi.mock("@/lib/notifications", () => ({
  insertNotification: vi.fn(async () => ({})),
}))

let smsSender: any
let emailSender: any

describe("send route templates", () => {
  beforeEach(async () => {
    h.state.campaigns = []
    h.state.recipients = []
    h.state.buyers = []
    h.state.buyerGroups = []
    h.state.recipientCounter = 1
    process.env.SUPABASE_URL = "http://local"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://local"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "tok"
    process.env.CRON_SECRET = "cron"
    process.env.TELNYX_MESSAGING_PROFILE_ID = "mp1"
    process.env.AWS_SES_FROM_EMAIL = "from@test.com"
    smsSender = await import("@/services/sms-campaign-sender")
    emailSender = await import("@/services/campaign-sender")
    ;(smsSender.queueSmsCampaign as any).mockClear()
    ;(smsSender.processSmsQueue as any).mockClear()
    ;(emailSender.queueEmailCampaign as any).mockClear()
    ;(emailSender.processEmailQueue as any).mockClear()
  })

  const req = (campaignId: string) =>
    new NextRequest("http://test", {
      method: "POST",
      headers: { Authorization: "Bearer tok" }, // matches SUPABASE_SERVICE_ROLE_KEY
      body: JSON.stringify({ campaignId }),
    })

  test("queues SMS with the raw template + recipients (rendering deferred)", async () => {
    h.state.campaigns.push({ id: "c1", channel: "sms", message: "Hi {{first_name}}", buyer_ids: ["b1"] })
    h.state.buyers.push({ id: "b1", fname: "John", lname: "Doe", phone: "+15125550111", can_receive_sms: true, deleted_at: null, email_suppressed: false })
    const res = await POST(req("c1"))
    expect(res.status).toBe(200)
    expect(smsSender.queueSmsCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "c1",
        recipients: expect.arrayContaining([
          expect.objectContaining({ buyerId: "b1", body: "Hi {{first_name}}" }),
        ]),
      }),
    )
  })

  test("queues email with the raw subject/html (rendering deferred)", async () => {
    h.state.campaigns.push({ id: "c2", channel: "email", subject: "Hey {{first_name}}", message: "Dear {{last_name}}", buyer_ids: ["b2"] })
    h.state.buyers.push({ id: "b2", fname: "Jane", lname: "Smith", email: "a@test.com", can_receive_email: true, deleted_at: null, email_suppressed: false })
    const res = await POST(req("c2"))
    expect(res.status).toBe(200)
    expect(emailSender.queueEmailCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "c2",
        subject: "Hey {{first_name}}",
        contacts: expect.arrayContaining([expect.objectContaining({ email: "a@test.com" })]),
      }),
      expect.anything(),
    )
  })

  test("replaces SMS URLs with per-recipient short links before queueing", async () => {
    h.state.campaigns.push({ id: "c5", channel: "sms", message: "See https://example.com now", buyer_ids: ["b5"] })
    h.state.buyers.push({ id: "b5", fname: "Alex", phone: "+15125550155", can_receive_sms: true, deleted_at: null, email_suppressed: false })
    const res = await POST(req("c5"))
    expect(res.status).toBe(200)
    const arg = (smsSender.queueSmsCampaign as any).mock.calls[0][0]
    expect(arg.recipients[0].body).toBe("See https://s.io/0 now")
  })

  test("queues the full SMS body without trimming", async () => {
    const msg = "x".repeat(170)
    h.state.campaigns.push({ id: "c3", channel: "sms", message: msg, buyer_ids: ["b3"] })
    h.state.buyers.push({ id: "b3", phone: "+15125550133", can_receive_sms: true, deleted_at: null, email_suppressed: false })
    const res = await POST(req("c3"))
    expect(res.status).toBe(200)
    expect(smsSender.queueSmsCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: expect.arrayContaining([expect.objectContaining({ body: msg })]),
      }),
    )
  })

  test("skips hidden buyers (no recipients -> 400, queue untouched)", async () => {
    h.state.campaigns.push({ id: "c4", channel: "sms", message: "Hi", buyer_ids: ["b4"] })
    h.state.buyers.push({ id: "b4", phone: "+15125550144", can_receive_sms: true, deleted_at: "2024-01-01", email_suppressed: false })
    const res = await POST(req("c4"))
    expect(res.status).toBe(400)
    expect(smsSender.queueSmsCampaign).not.toHaveBeenCalled()
  })

  test("returns 400 when no recipients", async () => {
    h.state.campaigns.push({ id: "c6", channel: "email", message: "Hi", buyer_ids: ["b6"] })
    const res = await POST(req("c6"))
    expect(res.status).toBe(400)
  })

  test("returns 200 when recipients exist", async () => {
    h.state.campaigns.push({ id: "c7", channel: "email", message: "Hello", buyer_ids: ["b7"] })
    h.state.buyers.push({ id: "b7", email: "a@test.com", can_receive_email: true, deleted_at: null, email_suppressed: false })
    const res = await POST(req("c7"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.queued).toBe(1)
  })

  test("merges buyer_ids and group_ids into ONE batched queue call", async () => {
    h.state.campaigns.push({ id: "c8", channel: "sms", message: "Hi", buyer_ids: ["b1"], group_ids: ["g1"] })
    h.state.buyers.push(
      { id: "b1", phone: "+15125550101", can_receive_sms: true, deleted_at: null, email_suppressed: false },
      { id: "b2", phone: "+15125550102", can_receive_sms: true, deleted_at: null, email_suppressed: false },
    )
    h.state.buyerGroups.push({ buyer_id: "b2", group_id: "g1" })
    const res = await POST(req("c8"))
    expect(res.status).toBe(200)

    expect(smsSender.queueSmsCampaign).toHaveBeenCalledTimes(1)
    const arg = (smsSender.queueSmsCampaign as any).mock.calls[0][0]
    const buyerIds = arg.recipients.map((r: any) => r.buyerId).sort()
    expect(buyerIds).toEqual(["b1", "b2"])
  })
})
