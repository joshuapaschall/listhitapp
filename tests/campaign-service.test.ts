import { describe, test, expect, beforeEach, afterAll, vi } from "vitest"
import { CampaignService } from "../services/campaign-service"

let campaigns: any[] = []
let recipients: any[] = []
let buyers: any[] = []
let idCounter = 1

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)


vi.mock("@/lib/supabase", () => {
  return {
    supabase: {
      // listCampaigns reads its metrics from SQL aggregates, not from embedded
      // recipient rows (PostgREST caps those at 1000). These mirror the real
      // functions in scripts/db/ so the counts the service reports are the
      // counts the database would actually return.
      rpc: async (fn: string, args: any = {}) => {
        switch (fn) {
          case "campaign_list_rollups": {
            const ids: string[] = args.p_campaign_ids ?? []
            const rows = new Map<string, any>()
            for (const r of recipients) {
              if (!ids.includes(r.campaign_id)) continue
              const row = rows.get(r.campaign_id) ?? {
                campaign_id: r.campaign_id,
                recipients: 0,
                sent: 0,
                delivered: 0,
                clicked: 0,
                opened: 0,
                errors: 0,
                bounced: 0,
                unsubscribed: 0,
              }
              row.recipients += 1
              // Counted off the timestamp columns, exactly as the SQL does —
              // a row with status "sent" but no sent_at is not a send.
              if (r.sent_at != null) row.sent += 1
              if (r.delivered_at != null) row.delivered += 1
              if (r.clicked_at != null) row.clicked += 1
              if (r.opened_at != null) row.opened += 1
              if (r.status === "error" || r.error != null) row.errors += 1
              if (r.bounced_at != null) row.bounced += 1
              if (r.unsubscribed_at != null) row.unsubscribed += 1
              rows.set(r.campaign_id, row)
            }
            return { data: [...rows.values()], error: null }
          }
          // No queue rows are seeded in this suite, so the real function would
          // group over an empty set and return nothing.
          case "campaign_queue_status":
            return { data: [], error: null }
          case "email_reputation_frozen":
            return { data: false, error: null }
          default:
            throw new Error(`Unexpected rpc ${fn}`)
        }
      },
      from: (table: string) => {
        switch (table) {
          case "campaigns":
            return {
              insert: (rows: any[]) => {
                const record = {
                  id: `c${idCounter++}`,
                  created_at: new Date(Date.now() + idCounter).toISOString(),
                  ...rows[0],
                }
                campaigns.push(record)
                return {
                  select: () => ({ single: async () => ({ data: record, error: null }) })
                }
              },
              update: (updates: any) => ({
                eq: (col: string, val: any) => ({
                  select: () => ({
                    single: async () => {
                      const rec = campaigns.find((c) => c[col] === val)
                      Object.assign(rec || {}, updates)
                      return { data: rec, error: null }
                    },
                  }),
                }),
              }),
              select: (_cols?: any, opts: any = {}) => {
                let result = campaigns.map((c) => ({
                  ...c,
                  campaign_recipients: recipients
                    .filter((r) => r.campaign_id === c.id)
                    .map((r) => ({ ...r, buyers: buyers.find((b) => b.id === r.buyer_id) })),
                }))
                let countResult = [...result]
                const query: any = {
                  eq: (column: string, value: any) => {
                    result = result.filter((c) => (c as any)[column] === value)
                    countResult = countResult.filter((c) => (c as any)[column] === value)
                    return query
                  },
                  order: (column: string, options: any = {}) => {
                    const asc = options.ascending !== false
                    result.sort((a: any, b: any) => {
                      if (a[column] === b[column]) return 0
                      return asc ? (a[column] > b[column] ? 1 : -1) : a[column] < b[column] ? 1 : -1
                    })
                    countResult.sort((a: any, b: any) => {
                      if (a[column] === b[column]) return 0
                      return asc ? (a[column] > b[column] ? 1 : -1) : a[column] < b[column] ? 1 : -1
                    })
                    return query
                  },
                  range: (from: number, to: number) => {
                    result = result.slice(from, to + 1)
                    return query
                  },
                  then: async (resolve: any) =>
                    resolve({ data: result, error: null, count: opts.count ? countResult.length : null }),
                  maybeSingle: async () => ({ data: result[0] || null, error: null }),
                  single: async () => ({ data: result[0] || null, error: null }),
                }
                return query
              },
            }
          case "campaign_recipients":
            return {
              insert: (rows: any[]) => {
                recipients.push(...rows)
                return { data: rows, error: null }
              },
              select: () => ({
                eq: (_col: string, val: any) => Promise.resolve({
                  data: recipients
                    .filter((r) => r.campaign_id === val)
                    .map((r) => ({ ...r, buyers: buyers.find((b) => b.id === r.buyer_id) })),
                  error: null,
                }),
              }),
              update: (updates: any) => ({
                eq: async (_col: string, val: any) => {
                  const rec = recipients.find((r) => r.id === val)
                  Object.assign(rec || {}, updates)
                  return { data: rec, error: null }
                },
              }),
            }
          case "buyer_sms_senders":
            return {
              select: () => ({
                eq: (_c: string, _v: any) => ({ maybeSingle: async () => ({ data: { from_number: "+1999" }, error: null }) })
              })
            }
          case "buyers":
            return {
              select: (cols: string = "*") => {
                let result = buyers.map((b) => ({ ...b }))
                const query: any = {
                  eq: (column: string, value: any) => {
                    result = result.filter((b: any) => b[column] === value)
                    return query
                  },
                  is: (column: string, value: any) => {
                    result = result.filter((b: any) => b[column] === value)
                    return query
                  },
                  in: (column: string, values: any[]) => {
                    result = result.filter((b: any) => values.includes(b[column]))
                    return query
                  },
                  overlaps: (column: string, arr: any[]) => {
                    result = result.filter((b: any) => {
                      const field = b[column] || []
                      return arr.some((v) => field.includes(v))
                    })
                    return query
                  },
                  gte: (column: string, value: any) => {
                    result = result.filter((b: any) => b[column] >= value)
                    return query
                  },
                  lte: (column: string, value: any) => {
                    result = result.filter((b: any) => b[column] <= value)
                    return query
                  },
                  maybeSingle: async () => ({ data: result[0] || null, error: null }),
                  single: async () => ({ data: result[0] || null, error: null }),
                  then: async (resolve: any) => {
                    const data = cols === "id" ? result.map((r: any) => ({ id: r.id })) : result
                    resolve({ data, error: null })
                  },
                }
                return query
              },
            }
          default:
            throw new Error(`Unexpected table ${table}`)
        }
      },
    },
  }
})

beforeEach(() => {
  campaigns = []
  recipients = []
  buyers = []
  idCounter = 1
  fetchMock.mockReset()
  // Re-apply after the MSW setup's beforeAll (tests/setup.ts) patches the
  // global fetch, so this suite's fetchMock intercepts the relative-URL calls.
  vi.stubGlobal("fetch", fetchMock)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe("CampaignService", () => {
  test("createCampaign inserts campaign and recipients", async () => {
    buyers.push({ id: "b1", phone: "+1000", email: "test@example.com", can_receive_sms: true, can_receive_email: true, deleted_at: null })
    await CampaignService.createCampaign({
      userId: "u1",
      name: "Test",
      channel: "sms",
      message: "hi",
      buyerIds: ["b1"],
      groupIds: [],
    })
    expect(campaigns.length).toBe(1)
    expect(recipients.length).toBe(1)
  })

  test("createCampaign ignores hidden buyers", async () => {
    buyers.push({ id: "b1", phone: "+1000", deleted_at: "2024-01-01" })
    await CampaignService.createCampaign({
      userId: "u1",
      name: "Test",
      channel: "sms",
      message: "hi",
      buyerIds: ["b1"],
      groupIds: [],
    })
    expect(recipients.length).toBe(0)
  })

  test("sendNow posts to API route for filtered campaign", async () => {
    const campaign = await CampaignService.createCampaign({
      userId: "u1",
      name: "Filtered",
      channel: "email",
      message: "msg",
      buyerIds: [],
      groupIds: [],
      filters: { tags: ["vip"], locations: ["FL"], minScore: 70 },
    })
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    await CampaignService.sendNow(campaign.id)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/campaigns/send-now",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ campaignId: campaign.id }),
      })
    )
  })

  test("sendNow posts to API route for email campaign", async () => {
    buyers.push({ id: "b1", phone: "+1222", email: "a@test.com", can_receive_sms: true, can_receive_email: true, deleted_at: null })
    const campaign = await CampaignService.createCampaign({
      userId: "u1",
      name: "Email Test",
      channel: "email",
      subject: "Hi",
      message: "<p>Hello</p>",
      buyerIds: ["b1"],
      groupIds: [],
    })
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    await CampaignService.sendNow(campaign.id)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/campaigns/send-now",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ campaignId: campaign.id }),
      })
    )
  })

  test("sendNow throws on failure", async () => {
    buyers.push({ id: "b1", phone: "+1222", email: "a@test.com", can_receive_sms: true, can_receive_email: true, deleted_at: null })
    const campaign = await CampaignService.createCampaign({ userId: "u1", name: "Test", channel: "sms", message: "fail", buyerIds: ["b1"], groupIds: [] })
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "bad" }) })
    await expect(CampaignService.sendNow(campaign.id)).rejects.toThrow("bad")
  })

  test("schedule updates campaign fields", async () => {
    buyers.push({ id: "b1", phone: "+1222", email: "a@test.com", can_receive_sms: true, can_receive_email: true, deleted_at: null })
    const campaign = await CampaignService.createCampaign({ userId: "u1", name: "Test", channel: "sms", message: "hi", buyerIds: ["b1"], groupIds: [] })
    const updated = await CampaignService.schedule(campaign.id, "2024-01-01T12:00:00Z", {
      weekdayOnly: true,
      runFrom: "09:00:00",
      runUntil: "17:00:00",
    })
    expect(updated.weekday_only).toBe(true)
    expect(updated.run_from).toBe("09:00:00")
    expect(updated.run_until).toBe("17:00:00")
  })

  test("listCampaigns paginates and returns metrics", async () => {
    for (let i = 1; i <= 25; i++) {
      buyers.push({ id: `b${i}`, deleted_at: null })
      const camp = await CampaignService.createCampaign({
        userId: "u1",
        name: `C${i}`,
        channel: "sms",
        message: "hi",
        buyerIds: [`b${i}`],
        groupIds: [],
      })
      const rec = recipients.find((r) => r.campaign_id === camp.id) as any
      rec.status = i % 2 === 0 ? "sent" : "error"
    }

    const page1 = await CampaignService.listCampaigns(1)
    expect(page1.totalCount).toBe(25)
    expect(page1.campaigns.length).toBe(10)
    expect(page1.campaigns[0]).toHaveProperty("sentCount")
    expect(page1.campaigns[0]).toHaveProperty("errorCount")

    // The counts come from the rollup RPC, not from embedded recipient rows —
    // assert they actually arrive rather than just that the keys exist.
    for (const campaign of page1.campaigns) {
      const recipient = recipients.find((r) => r.campaign_id === campaign.id) as any
      expect(campaign.recipientCount).toBe(1)
      expect(campaign.errorCount).toBe(recipient.status === "error" ? 1 : 0)
    }

    const page2 = await CampaignService.listCampaigns(2)
    expect(page2.campaigns.length).toBe(10)
    expect(page2.campaigns[0]).toHaveProperty("sentCount")
    expect(page2.campaigns[0]).toHaveProperty("errorCount")

    const page3 = await CampaignService.listCampaigns(3)
    expect(page3.campaigns.length).toBe(5)
  })

  test("listCampaigns includes buyer names", async () => {
    buyers.push({ id: "b1", full_name: "John Doe", fname: "John", lname: "Doe", can_receive_sms: true, can_receive_email: true, deleted_at: null })
    await CampaignService.createCampaign({
      userId: "u1",
      name: "Test",
      channel: "sms",
      message: "hi",
      buyerIds: ["b1"],
      groupIds: [],
    })

    const result = await CampaignService.listCampaigns(1)
    const recipient = result.campaigns[0].campaign_recipients[0]
    expect(recipient.buyers.full_name).toBe("John Doe")
  })
})
