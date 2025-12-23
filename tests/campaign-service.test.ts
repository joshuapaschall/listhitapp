import { describe, expect, test, beforeEach, jest } from "@jest/globals"
import { CampaignService } from "../services/campaign-service"

let campaigns: any[] = []
let recipients: any[] = []
let buyers: any[] = []
let idCounter = 1

const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock

jest.mock("@/lib/supabase", () => {
  const client = {
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
    }
  return { __esModule: true, supabase: client, supabaseAdmin: client }
})

beforeEach(() => {
  campaigns = []
  recipients = []
  buyers = []
  idCounter = 1
  fetchMock.mockReset()
})

describe("CampaignService", () => {
  test("createCampaign inserts campaign and recipients", async () => {
    buyers.push({ id: "b1", phone: "+1000", email: "test@example.com", can_receive_sms: true, can_receive_email: true, sendfox_hidden: false })
    const campaign = await CampaignService.createCampaign({
      userId: "u1",
      name: "Test",
      channel: "sms",
      message: "hello",
      buyerIds: ["b1"],
      groupIds: [],
    })
    expect(campaigns.length).toBe(1)
    expect(campaigns[0].buyer_ids).toEqual(["b1"])
    expect(campaigns[0].group_ids).toBeNull()
    expect(recipients.length).toBe(1)
    expect(recipients[0].campaign_id).toBe(campaign.id)
  })

  test("createCampaign ignores hidden buyers", async () => {
    buyers.push({ id: "b1", phone: "+1000", sendfox_hidden: true })
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

  test("createCampaign resolves recipients from filters", async () => {
    buyers.push({ id: "b1", tags: ["vip"], locations: ["FL"], score: 80, sendfox_hidden: false })
    const campaign = await CampaignService.createCampaign({
      userId: "u1",
      name: "Filtered",
      channel: "email",
      message: "msg",
      buyerIds: [],
      groupIds: [],
      filters: { tags: ["vip"], locations: ["FL"], minScore: 70 },
    })
    expect(recipients.length).toBe(1)
    expect(recipients[0].campaign_id).toBe(campaign.id)
    expect(recipients[0].buyer_id).toBe("b1")
  })

  test("createCampaign stores schedule data and defaults status to pending", async () => {
    const scheduledAt = "2024-01-01T12:00:00.000Z"
    const campaign = await CampaignService.createCampaign({
      userId: "u1",
      name: "Scheduled",
      channel: "email",
      message: "msg",
      buyerIds: [],
      groupIds: [],
      scheduled_at: scheduledAt,
      weekday_only: true,
      run_from: "09:00:00",
      run_until: "17:00:00",
    })
    expect(campaigns[0].scheduled_at).toBe(scheduledAt)
    expect(campaigns[0].weekday_only).toBe(true)
    expect(campaigns[0].run_from).toBe("09:00:00")
    expect(campaigns[0].run_until).toBe("17:00:00")
    expect(campaigns[0].status).toBe("pending")
    expect(campaign.status).toBe("pending")
  })

  test("sendNow posts to API route", async () => {
    buyers.push({ id: "b1", phone: "+1222", email: "a@test.com", can_receive_sms: true, can_receive_email: true, sendfox_hidden: false })
    const campaign = await CampaignService.createCampaign({ userId: "u1", name: "Test", channel: "sms", message: "hi", buyerIds: ["b1"], groupIds: [] })
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
    buyers.push({ id: "b1", phone: "+1222", email: "a@test.com", can_receive_sms: true, can_receive_email: true, sendfox_hidden: false })
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
    buyers.push({ id: "b1", phone: "+1222", email: "a@test.com", can_receive_sms: true, can_receive_email: true, sendfox_hidden: false })
    const campaign = await CampaignService.createCampaign({ userId: "u1", name: "Test", channel: "sms", message: "fail", buyerIds: ["b1"], groupIds: [] })
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "bad" }) })
    await expect(CampaignService.sendNow(campaign.id)).rejects.toThrow("bad")
  })

  test("schedule updates campaign fields", async () => {
    buyers.push({ id: "b1", phone: "+1222", email: "a@test.com", can_receive_sms: true, can_receive_email: true, sendfox_hidden: false })
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
      buyers.push({ id: `b${i}`, sendfox_hidden: false })
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
    expect(page1.campaigns.length).toBe(20)
    expect(page1.campaigns[0]).toHaveProperty("sentCount")
    expect(page1.campaigns[0]).toHaveProperty("errorCount")

    const page2 = await CampaignService.listCampaigns(2)
    expect(page2.campaigns.length).toBe(5)
    expect(page2.campaigns[0]).toHaveProperty("sentCount")
    expect(page2.campaigns[0]).toHaveProperty("errorCount")
  })

  test("listCampaigns includes buyer names", async () => {
    buyers.push({ id: "b1", full_name: "John Doe", fname: "John", lname: "Doe", can_receive_sms: true, can_receive_email: true, sendfox_hidden: false })
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
