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
    segments: [] as any[],
    recipientCounter: 1,
    campaignUpdates: [] as any[],
    resolveCalls: [] as any[],
    resolveImpl: async (_def: any, _ctx: any) => new Set<string>(),
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
      not: (col: string, op: string, val: any) => {
        if (op === "is" && val === null) rows = rows.filter((r) => nested(r, col) != null)
        else rows = rows.filter((r) => nested(r, col) !== val)
        return q
      },
      // Real PostgREST orders by the column; deterministic paging depends on it.
      order: (col: string, opts?: { ascending?: boolean }) => {
        const asc = opts?.ascending !== false
        rows = [...rows].sort((a, b) => {
          const x = nested(a, col)
          const y = nested(b, col)
          if (x === y) return 0
          return (x > y ? 1 : -1) * (asc ? 1 : -1)
        })
        return q
      },
      // `to` is INCLUSIVE in PostgREST.
      range: (from: number, to: number) => {
        rows = rows.slice(from, to + 1)
        return q
      },
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
          update: (patch: any) => {
            state.campaignUpdates.push(patch)
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
      if (table === "segments") {
        return { select: () => chainable(() => state.segments) }
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
// Dynamic resolve-at-dispatch: record calls and return the per-test set.
vi.mock("@/lib/segments/resolver", () => ({
  resolveSegment: async (def: any, ctx: any) => {
    h.state.resolveCalls.push({ def, ctx })
    return h.state.resolveImpl(def, ctx)
  },
}))

let smsSender: any
let emailSender: any

describe("send route templates", () => {
  beforeEach(async () => {
    h.state.campaigns = []
    h.state.recipients = []
    h.state.buyers = []
    h.state.buyerGroups = []
    h.state.segments = []
    h.state.recipientCounter = 1
    h.state.campaignUpdates = []
    h.state.resolveCalls = []
    h.state.resolveImpl = async () => new Set<string>()
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
    h.state.buyers.push({ id: "b1", fname: "John", lname: "Doe", phone: "+15125550111", can_receive_sms: true, sms_suppressed: false, deleted_at: null, email_suppressed: false })
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

  test("reads back more than one page of recipients (pagination past the 1000-row cap)", async () => {
    // 1,500 SMS-eligible buyers — forces the campaign_recipients read-back to page
    // twice (1000 + 500). Guards the #779 contract: fetchAllRows must chain
    // .order().range() and loop, not truncate at the first 1000-row page.
    const ids = Array.from({ length: 1500 }, (_, i) => `bp${String(i).padStart(4, "0")}`)
    h.state.campaigns.push({ id: "cpage", channel: "sms", message: "Hi", buyer_ids: ids })
    ids.forEach((id, i) =>
      h.state.buyers.push({
        id,
        phone: `+1512555${String(1000 + i).padStart(4, "0")}`,
        can_receive_sms: true,
        sms_suppressed: false,
        deleted_at: null,
        email_suppressed: false,
      }),
    )
    const res = await POST(req("cpage"))
    expect(res.status).toBe(200)
    const arg = (smsSender.queueSmsCampaign as any).mock.calls[0][0]
    expect(arg.recipients).toHaveLength(1500)
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
    h.state.buyers.push({ id: "b5", fname: "Alex", phone: "+15125550155", can_receive_sms: true, sms_suppressed: false, deleted_at: null, email_suppressed: false })
    const res = await POST(req("c5"))
    expect(res.status).toBe(200)
    const arg = (smsSender.queueSmsCampaign as any).mock.calls[0][0]
    expect(arg.recipients[0].body).toBe("See https://s.io/0 now")
  })

  test("queues the full SMS body without trimming", async () => {
    const msg = "x".repeat(170)
    h.state.campaigns.push({ id: "c3", channel: "sms", message: msg, buyer_ids: ["b3"] })
    h.state.buyers.push({ id: "b3", phone: "+15125550133", can_receive_sms: true, sms_suppressed: false, deleted_at: null, email_suppressed: false })
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
      { id: "b1", phone: "+15125550101", can_receive_sms: true, sms_suppressed: false, deleted_at: null, email_suppressed: false },
      { id: "b2", phone: "+15125550102", can_receive_sms: true, sms_suppressed: false, deleted_at: null, email_suppressed: false },
    )
    h.state.buyerGroups.push({ buyer_id: "b2", group_id: "g1" })
    const res = await POST(req("c8"))
    expect(res.status).toBe(200)

    expect(smsSender.queueSmsCampaign).toHaveBeenCalledTimes(1)
    const arg = (smsSender.queueSmsCampaign as any).mock.calls[0][0]
    const buyerIds = arg.recipients.map((r: any) => r.buyerId).sort()
    expect(buyerIds).toEqual(["b1", "b2"])
  })

  test("SMS reaches an email-suppressed + SMS-opted-in buyer, never a STOP'd one", async () => {
    h.state.campaigns.push({ id: "c9", channel: "sms", message: "Hi", buyer_ids: ["bs1", "bs2"] })
    h.state.buyers.push(
      // email hard-bounced (email_suppressed) but SMS-opted-in → must be reached
      { id: "bs1", phone: "+15125559001", can_receive_sms: true, sms_suppressed: false, deleted_at: null, email_suppressed: true },
      // STOP'd → must never be reached
      { id: "bs2", phone: "+15125559002", can_receive_sms: false, sms_suppressed: false, deleted_at: null, email_suppressed: false },
    )
    const res = await POST(req("c9"))
    expect(res.status).toBe(200)
    const arg = (smsSender.queueSmsCampaign as any).mock.calls[0][0]
    const ids = arg.recipients.map((r: any) => r.buyerId)
    expect(ids).toContain("bs1")
    expect(ids).not.toContain("bs2")
  })

  test("email still excludes email-suppressed buyers", async () => {
    h.state.campaigns.push({ id: "c10", channel: "email", message: "Hello", buyer_ids: ["be1"] })
    h.state.buyers.push({ id: "be1", email: "z@test.com", can_receive_email: true, deleted_at: null, email_suppressed: true })
    const res = await POST(req("c10"))
    expect(res.status).toBe(400) // no eligible recipients
    expect(emailSender.queueEmailCampaign).not.toHaveBeenCalled()
  })

  // ── Phase 3c-ii: dynamic resolve-at-dispatch ──────────────────────────────
  const smsBuyer = (id: string, n: string) => ({
    id, phone: n, can_receive_sms: true, sms_suppressed: false, deleted_at: null, email_suppressed: false,
  })

  test("audience_definition re-resolves fresh at send (not the stale buyer_ids)", async () => {
    h.state.campaigns.push({
      id: "d1", channel: "sms", message: "Hi", org_id: "org-1",
      audience_definition: { match: "all", conditions: [] }, buyer_ids: ["stale"], audience_preview_count: 1,
    })
    h.state.buyers.push(smsBuyer("fresh1", "+15125557001"), smsBuyer("stale", "+15125557000"))
    h.state.resolveImpl = async () => new Set(["fresh1"])

    const res = await POST(req("d1"))
    expect(res.status).toBe(200)
    const ids = (smsSender.queueSmsCampaign as any).mock.calls[0][0].recipients.map((r: any) => r.buyerId)
    expect(ids).toContain("fresh1")
    expect(ids).not.toContain("stale")
    expect(h.state.resolveCalls).toHaveLength(1)
    expect(h.state.resolveCalls[0].ctx.orgId).toBe("org-1") // scoped to the campaign's org
  })

  test("segment_id loads the saved segment's definition (org-scoped) and resolves it", async () => {
    const def = { match: "all", conditions: [{ kind: "attribute", field: "vip", operator: "is", value: true }] }
    h.state.campaigns.push({ id: "d2", channel: "sms", message: "Hi", org_id: "org-1", segment_id: "seg-1", audience_preview_count: 1 })
    h.state.segments.push({ id: "seg-1", org_id: "org-1", deleted_at: null, definition: def })
    h.state.buyers.push(smsBuyer("s1", "+15125557010"))
    h.state.resolveImpl = async () => new Set(["s1"])

    const res = await POST(req("d2"))
    expect(res.status).toBe(200)
    const ids = (smsSender.queueSmsCampaign as any).mock.calls[0][0].recipients.map((r: any) => r.buyerId)
    expect(ids).toEqual(["s1"])
    expect(h.state.resolveCalls[0].def).toEqual(def)
    expect(h.state.resolveCalls[0].ctx.orgId).toBe("org-1")
  })

  test("resolve throws → falls back to the stored buyer_ids snapshot; send still completes", async () => {
    h.state.campaigns.push({
      id: "d3", channel: "sms", message: "Hi", org_id: "org-1",
      audience_definition: { match: "all", conditions: [] }, buyer_ids: ["snap1"], audience_preview_count: 1,
    })
    h.state.buyers.push(smsBuyer("snap1", "+15125557020"))
    h.state.resolveImpl = async () => { throw new Error("boom") }

    const res = await POST(req("d3"))
    expect(res.status).toBe(200)
    const ids = (smsSender.queueSmsCampaign as any).mock.calls[0][0].recipients.map((r: any) => r.buyerId)
    expect(ids).toEqual(["snap1"]) // snapshot used
  })

  test("successful empty resolution is respected (no fallback, sends to nobody)", async () => {
    h.state.campaigns.push({
      id: "d4", channel: "sms", message: "Hi", org_id: "org-1",
      audience_definition: { match: "all", conditions: [] }, buyer_ids: ["snap1"], audience_preview_count: 1,
    })
    h.state.buyers.push(smsBuyer("snap1", "+15125557030"))
    h.state.resolveImpl = async () => new Set<string>()

    const res = await POST(req("d4"))
    expect(res.status).toBe(400) // no recipients
    expect(smsSender.queueSmsCampaign).not.toHaveBeenCalled()
  })

  test("does not pause dynamic sends when preview count is zero or absent", async () => {
    h.state.campaigns.push({
      id: "d-zero", channel: "sms", message: "Hi", org_id: "org-1",
      audience_definition: { match: "all", conditions: [] }, buyer_ids: ["snap1"], audience_preview_count: 0,
    })
    h.state.buyers.push(smsBuyer("r1", "+15125550001"))
    h.state.resolveImpl = async () => new Set(["r1", ...Array.from({ length: 4999 }, (_, i) => `zr${i}`)])

    const zeroRes = await POST(req("d-zero"))
    expect(zeroRes.status).toBe(200)
    expect((await zeroRes.json()).paused).toBeUndefined()

    h.state.campaigns = [{
      id: "d-null", channel: "sms", message: "Hi", org_id: "org-1",
      audience_definition: { match: "all", conditions: [] }, buyer_ids: ["snap1"], audience_preview_count: null,
    }]
    h.state.resolveCalls = []
    h.state.campaignUpdates = []
    h.state.resolveImpl = async () => new Set(["r1", ...Array.from({ length: 4999 }, (_, i) => `nr${i}`)])

    const nullRes = await POST(req("d-null"))
    expect(nullRes.status).toBe(200)
    expect((await nullRes.json()).paused).toBeUndefined()
  })

  test("drift guard pauses (status error, no send) when resolution expands past the ceiling", async () => {
    h.state.campaigns.push({
      id: "d5", channel: "sms", message: "Hi", org_id: "org-1",
      audience_definition: { match: "all", conditions: [] }, buyer_ids: ["snap1"], audience_preview_count: 100,
    })
    h.state.buyers.push(smsBuyer("snap1", "+15125557040"))
    // preview 100 → ceiling max(200, 350) = 350; resolve to 351 → over the ceiling.
    h.state.resolveImpl = async () => new Set(Array.from({ length: 351 }, (_, i) => `x${i}`))

    const res = await POST(req("d5"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.paused).toBe(true)
    expect(body.reason).toBe("audience_drift_guard")
    expect(body.ceiling).toBe(350)
    expect(smsSender.queueSmsCampaign).not.toHaveBeenCalled()
    const errUpdate = h.state.campaignUpdates.find((u: any) => u.status === "error")
    expect(errUpdate?.error).toMatch(/audience_drift_guard/)
  })

  test("shrinkage never pauses dynamic sends", async () => {
    h.state.campaigns.push({
      id: "d-shrink", channel: "sms", message: "Hi", org_id: "org-1",
      audience_definition: { match: "all", conditions: [] }, buyer_ids: ["snap1"], audience_preview_count: 100,
    })
    h.state.buyers.push({ id: "b1", phone: "+15125550001", can_receive_sms: true, sms_suppressed: false, deleted_at: null })
    h.state.resolveImpl = async () => new Set(["b1"])

    const res = await POST(req("d-shrink"))
    expect(res.status).toBe(200)
    expect((await res.json()).paused).toBeUndefined()
    expect(h.state.campaignUpdates.find((u: any) => u.status === "error")).toBeUndefined()
  })

  test("legacy campaign (no segment fields) never calls resolveSegment", async () => {
    h.state.campaigns.push({ id: "d6", channel: "sms", message: "Hi", buyer_ids: ["b1"] })
    h.state.buyers.push(smsBuyer("b1", "+15125557050"))
    const res = await POST(req("d6"))
    expect(res.status).toBe(200)
    expect(h.state.resolveCalls).toHaveLength(0)
  })

  test("cross-tenant: a segment_id owned by another org is not loaded; falls back to snapshot", async () => {
    h.state.campaigns.push({ id: "d7", channel: "sms", message: "Hi", org_id: "org-1", segment_id: "seg-b", buyer_ids: ["snapA"], audience_preview_count: 1 })
    // segment belongs to org B — the org-scoped lookup must not return it.
    h.state.segments.push({ id: "seg-b", org_id: "org-2", deleted_at: null, definition: { match: "all", conditions: [] } })
    h.state.buyers.push(smsBuyer("snapA", "+15125557060"))

    const res = await POST(req("d7"))
    expect(res.status).toBe(200)
    expect(h.state.resolveCalls).toHaveLength(0) // definition null → no resolve
    const ids = (smsSender.queueSmsCampaign as any).mock.calls[0][0].recipients.map((r: any) => r.buyerId)
    expect(ids).toEqual(["snapA"]) // snapshot used
  })
})
