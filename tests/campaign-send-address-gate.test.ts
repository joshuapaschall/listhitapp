// CAN-SPAM requires the sender's postal address in every marketing email.
// Gating BEFORE anything is queued gives the user an actionable 400 instead of
// a half-sent campaign with the reason buried in queue rows.

import { NextRequest } from "next/server"

const h = vi.hoisted(() => {
  const state: any = {
    organization: null as any,
    campaigns: [] as any[],
    buyers: [] as any[],
    recipients: [] as any[],
    recipientCounter: 1,
  }

  const nested = (row: any, path: string) =>
    path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), row)

  function chainable(getRows: () => any[]) {
    let rows = getRows()
    const q: any = {
      select: () => q,
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
      not: (col: string, op: string, val: any) =>
        op === "is" && val === null
          ? ((rows = rows.filter((r) => nested(r, col) != null)), q)
          : ((rows = rows.filter((r) => nested(r, col) !== val)), q),
      order: () => q,
      range: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      single: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: any) => resolve({ data: rows, error: null }),
    }
    return q
  }

  const client: any = {
    from: (table: string) => {
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.organization, error: null }) }),
          }),
        }
      }
      if (table === "campaigns") {
        return {
          select: () => chainable(() => state.campaigns),
          update: () => {
            const q: any = {
              eq: () => q,
              in: () => q,
              is: async () => ({ error: null }),
              then: (resolve: any) => resolve({ error: null }),
            }
            return q
          },
        }
      }
      if (table === "buyers") {
        return {
          select: () => chainable(() => state.buyers),
          update: () => ({ eq: async () => ({ error: null }), in: async () => ({ error: null }) }),
        }
      }
      if (table === "campaign_recipients") {
        return {
          select: () =>
            chainable(() =>
              state.recipients.map((r: any) => ({
                ...r,
                buyers: state.buyers.find((b: any) => b.id === r.buyer_id),
              })),
            ),
          insert: async (rows: any[]) => {
            rows.forEach((r) =>
              state.recipients.push({ id: `r${state.recipientCounter++}`, ...r }),
            )
            return { error: null }
          },
          delete: () => ({ eq: async () => ({ error: null }) }),
          update: () => ({ eq: async () => ({ error: null }), in: async () => ({ error: null }) }),
        }
      }
      if (table === "segments") return { select: () => chainable(() => []) }
      if (table === "buyer_groups") return { select: () => chainable(() => []) }
      if (table === "buyer_sms_senders") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
      }
      throw new Error(`Unexpected table ${table}`)
    },
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }

  return { state, client, queueEmail: vi.fn(), queueSms: vi.fn() }
})

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.client, supabase: h.client }))
vi.mock("@/services/campaign-sender", () => ({
  queueEmailCampaign: h.queueEmail,
  processEmailQueue: vi.fn(async () => 0),
  stampBusinessAddressForCampaign: vi.fn(async (html: string) => html),
}))
vi.mock("@/services/sms-campaign-sender", () => ({
  queueSmsCampaign: h.queueSms,
  processSmsQueue: vi.fn(async () => ({ processed: 0, sent: 0 })),
}))
vi.mock("@/lib/email-sender-resolver", () => ({
  resolveCampaignSender: vi.fn(async () => ({
    fromEmail: "hello@tenant.test",
    fromName: "Tenant",
    replyTo: undefined,
    source: "org_default",
  })),
  SenderNotVerifiedError: class extends Error {},
}))

import { POST } from "../app/api/campaigns/send/route"

const COMPLETE_ORG = {
  name: "Tenant",
  business_name: "Tenant LLC",
  address_line1: "1 Main St",
  address_line2: null,
  city: "Atlanta",
  state: "GA",
  zip: "30301",
  phone: "+14045551212",
  website_url: null,
}

const req = (campaignId: string) =>
  new NextRequest("http://test/api/campaigns/send", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer cron" },
    body: JSON.stringify({ campaignId }),
  })

describe("email campaigns are gated on the org's CAN-SPAM address", () => {
  beforeEach(() => {
    h.state.organization = { ...COMPLETE_ORG }
    h.state.campaigns = []
    h.state.buyers = []
    h.state.recipients = []
    h.state.recipientCounter = 1
    h.queueEmail.mockReset()
    h.queueSms.mockReset()
    process.env.CRON_SECRET = "cron"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://local"
    process.env.SUPABASE_URL = "http://local"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "tok"
    process.env.SITE_URL = "https://app.test"
    process.env.TELNYX_MESSAGING_PROFILE_ID = "mp1"
  })

  test("an incomplete address → 400 missing_business_address, nothing queued", async () => {
    h.state.organization = { ...COMPLETE_ORG, zip: "" }
    h.state.campaigns.push({
      id: "c-email", org_id: "org-1", channel: "email",
      subject: "Hi", message: "<p>Hi</p>", buyer_ids: ["b1"],
    })
    h.state.buyers.push({
      id: "b1", org_id: "org-1", email: "a@test.com",
      can_receive_email: true, deleted_at: null, email_suppressed: false,
    })

    const res = await POST(req("c-email"))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe("missing_business_address")
    expect(body.error).toContain("Settings → Organization")
    expect(h.queueEmail).not.toHaveBeenCalled()
  })

  test("a missing organization row → 400, nothing queued", async () => {
    h.state.organization = null
    h.state.campaigns.push({
      id: "c-email2", org_id: "org-1", channel: "email",
      subject: "Hi", message: "<p>Hi</p>", buyer_ids: ["b1"],
    })
    h.state.buyers.push({
      id: "b1", org_id: "org-1", email: "a@test.com",
      can_receive_email: true, deleted_at: null, email_suppressed: false,
    })

    const res = await POST(req("c-email2"))

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe("missing_business_address")
    expect(h.queueEmail).not.toHaveBeenCalled()
  })

  test("a complete address queues the campaign", async () => {
    h.state.campaigns.push({
      id: "c-ok", org_id: "org-1", channel: "email",
      subject: "Hi", message: "<p>Hi</p>", buyer_ids: ["b1"],
    })
    h.state.buyers.push({
      id: "b1", org_id: "org-1", email: "a@test.com",
      can_receive_email: true, deleted_at: null, email_suppressed: false,
    })

    const res = await POST(req("c-ok"))

    expect(res.status).toBe(200)
    expect(h.queueEmail).toHaveBeenCalledTimes(1)
  })

  test("SMS campaigns are unaffected by a missing address", async () => {
    h.state.organization = { ...COMPLETE_ORG, address_line1: "", city: "", state: "", zip: "" }
    h.state.campaigns.push({
      id: "c-sms", org_id: "org-1", channel: "sms", message: "Hi", buyer_ids: ["b2"],
    })
    h.state.buyers.push({
      id: "b2", org_id: "org-1", phone: "+15125550102",
      can_receive_sms: true, sms_suppressed: false, deleted_at: null, email_suppressed: false,
    })

    const res = await POST(req("c-sms"))

    expect(res.status).toBe(200)
    expect(h.queueSms).toHaveBeenCalledTimes(1)
    expect(h.queueEmail).not.toHaveBeenCalled()
  })
})
