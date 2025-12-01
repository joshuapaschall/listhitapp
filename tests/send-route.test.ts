import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/campaigns/send/route"

let campaigns: any[] = []
let recipients: any[] = []
let buyers: any[] = []
let buyerGroups: any[] = []
let smsMock = jest.fn()
let emailMock = jest.fn()
let shortMock = jest.fn()
let supabase: any
let recipientUpdates: any[] = []
let recipientCounter = 1

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => supabase,
}))

jest.mock("../services/campaign-sender.server", () => ({
  sendCampaignSMS: (...args: any[]) => smsMock(...args),
}))
jest.mock("../services/campaign-sender", () => ({
  sendEmailCampaign: (...args: any[]) => emailMock(...args),
}))

jest.mock("../services/shortio-service", () => ({
  replaceUrlsWithShortLinks: (...args: any[]) => shortMock(...args),
}))

jest.mock("@/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabase
  },
  get supabase() {
    return supabase
  },
}))

function buildSupabase() {
  return {
    from: (table: string) => {
      if (table === "campaigns") {
        return {
          select: () => ({
            eq: (_c: string, id: string) => ({
              maybeSingle: async () => ({
                data: campaigns.find((c) => c.id === id) || null,
                error: null,
              }),
            }),
          }),
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
        }
      }
      if (table === "campaign_recipients") {
        return {
          select: () => {
            let result = recipients.map((r) => ({ ...r }))
            const query: any = {
              eq: (col: string, val: any) => {
                if (col === "campaign_id") result = result.filter((r) => r.campaign_id === val)
                if (col === "buyers.sendfox_hidden") result = result.filter((r) => !r.buyers?.sendfox_hidden)
                if (col === "buyers.sendfox_suppressed") result = result.filter((r) => !r.buyers?.sendfox_suppressed)
                return query
              },
              then: async (resolve: any) => resolve({ data: result, error: null })
            }
            return query
          },
          insert: async (rows: any[]) => {
            rows.forEach((r) => {
              recipients.push({
                id: `r${recipientCounter++}`,
                ...r,
                buyers: buyers.find((b) => b.id === r.buyer_id),
              })
            })
            return { error: null }
          },
          delete: () => ({
            eq: (col: string, val: any) => {
              recipients = recipients.filter((r) => r[col] !== val)
              return Promise.resolve({ error: null })
            },
          }),
          update: (updates: any) => ({
            eq: async (_c: string, id: string) => {
              const row = recipients.find((r) => r.id === id)
              if (row) Object.assign(row, updates)
              recipientUpdates.push({ updates, id })
              return { data: row, error: null }
            },
          }),
        }
      }
      if (table === "buyer_groups") {
        return {
          select: () => {
            let result = buyerGroups.map((g) => ({ ...g, buyers: buyers.find((b) => b.id === g.buyer_id) }))
            const query: any = {
              in: (_col: string, vals: any[]) => {
                result = result.filter((r) => vals.includes(r.group_id))
                return query
              },
              eq: (col: string, val: any) => {
                if (col === "buyers.sendfox_hidden") result = result.filter((r) => !r.buyers?.sendfox_hidden)
                if (col === "buyers.sendfox_suppressed") result = result.filter((r) => !r.buyers?.sendfox_suppressed)
                return query
              },
              then: async (resolve: any) => resolve({ data: result, error: null })
            }
            return query
          }
        }
      }
      if (table === "buyers") {
        return {
          select: () => ({
            in: (_col: string, vals: any[]) => ({
              eq: (col: string, val: any) => {
                const data = buyers.filter((b) => vals.includes(b.id) && b[col] === val)
                return Promise.resolve({ data, error: null })
              },
            }),
          }),
        }
      }
      if (table === "buyer_sms_senders") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
}

describe("send route templates", () => {
  beforeEach(() => {
    campaigns = []
    recipients = []
    buyers = []
    buyerGroups = []
    recipientUpdates = []
    smsMock.mockReset()
    emailMock.mockReset()
    shortMock.mockReset()
    recipientCounter = 1
    supabase = buildSupabase()
    process.env.SUPABASE_SERVICE_ROLE_KEY = "tok"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://local"
  })

  test("renders template for SMS", async () => {
    campaigns.push({ id: "c1", channel: "sms", message: "Hi {{first_name}}", buyer_ids: ["b1"] })
    buyers.push({ id: "b1", fname: "John", lname: "Doe", phone: "+1222", can_receive_sms: true, sendfox_hidden: false })
    smsMock.mockResolvedValue([{ sid: "1", from: "+1555" }])
    shortMock.mockResolvedValue({ html: "Hi John", key: "k1" })
    const req = new NextRequest("http://test", {
      method: "POST",
      headers: { "Authorization": "Bearer tok" },
      body: JSON.stringify({ campaignId: "c1" }),
    })
    await POST(req)
    expect(shortMock).toHaveBeenCalled()
    expect(smsMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Hi John" })
    )
    expect(recipientUpdates[0].updates.short_url_key).toBe("k1")
  })

  test("renders template for email", async () => {
    campaigns.push({ id: "c2", channel: "email", subject: "Hey {{first_name}}", message: "Dear {{last_name}}", buyer_ids: ["b2"] })
    buyers.push({ id: "b2", fname: "Jane", lname: "Smith", email: "a@test.com", can_receive_email: true, sendfox_hidden: false })
    emailMock.mockResolvedValue("id1")
    const req = new NextRequest("http://test", {
      method: "POST",
      headers: { "Authorization": "Bearer tok" },
      body: JSON.stringify({ campaignId: "c2" }),
    })
    await POST(req)
    expect(shortMock).toHaveBeenCalled()
    expect(emailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Hey Jane" })
    )
  })

  test("trims SMS body after short link replacement", async () => {
    const msg = "x".repeat(170)
    campaigns.push({ id: "c3", channel: "sms", message: msg, buyer_ids: ["b3"] })
    buyers.push({ id: "b3", phone: "+1999", can_receive_sms: true, sendfox_hidden: false })
    smsMock.mockResolvedValue([{ sid: "1", from: "+1555" }])
    shortMock.mockResolvedValue({ html: msg, key: "k1" })
    const req = new NextRequest("http://test", {
      method: "POST",
      headers: { "Authorization": "Bearer tok" },
      body: JSON.stringify({ campaignId: "c3" }),
    })
    await POST(req)
    expect(smsMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: msg.slice(0, 160) })
    )
    expect(recipientUpdates[0].updates.short_url_key).toBe("k1")
  })

  test("skips hidden buyers", async () => {
    campaigns.push({ id: "c4", channel: "sms", message: "Hi", buyer_ids: ["b4"] })
    buyers.push({ id: "b4", phone: "+1222", can_receive_sms: true, sendfox_hidden: true })
    smsMock.mockResolvedValue([{ sid: "1", from: "+1555" }])
    const req = new NextRequest("http://test", {
      method: "POST",
      headers: { Authorization: "Bearer tok" },
      body: JSON.stringify({ campaignId: "c4" }),
    })
    await POST(req)
    expect(smsMock).not.toHaveBeenCalled()
  })

  test("returns 400 when no recipients", async () => {
    campaigns.push({ id: "c5", channel: "email", message: "Hi", buyer_ids: ["b5"] })
    const req = new NextRequest("http://test", {
      method: "POST",
      headers: { Authorization: "Bearer tok" },
      body: JSON.stringify({ campaignId: "c5" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test("returns 200 when recipients exist", async () => {
    campaigns.push({ id: "c6", channel: "email", message: "Hello", buyer_ids: ["b6"] })
    buyers.push({ id: "b6", email: "a@test.com", can_receive_email: true, sendfox_hidden: false })
    emailMock.mockResolvedValue("id1")
    const req = new NextRequest("http://test", {
      method: "POST",
      headers: { Authorization: "Bearer tok" },
      body: JSON.stringify({ campaignId: "c6" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(1)
  })

  test("merges buyer_ids and group_ids arrays to build recipients", async () => {
    campaigns.push({
      id: "c7",
      channel: "sms",
      message: "Hi",
      buyer_ids: ["b1"],
      group_ids: ["g1"],
    })
    buyers.push(
      { id: "b1", phone: "+1222", can_receive_sms: true, sendfox_hidden: false, sendfox_suppressed: false },
      { id: "b2", phone: "+1333", can_receive_sms: true, sendfox_hidden: false, sendfox_suppressed: false },
    )
    buyerGroups.push({ buyer_id: "b2", group_id: "g1" })
    smsMock.mockResolvedValue([{ sid: "1", from: "+1555" }])

    const req = new NextRequest("http://test", {
      method: "POST",
      headers: { Authorization: "Bearer tok" },
      body: JSON.stringify({ campaignId: "c7" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const campaignRecipients = recipients
      .filter((r) => r.campaign_id === "c7")
      .map((r) => r.buyer_id)
      .sort()
    expect(campaignRecipients).toEqual(["b1", "b2"])
    expect(smsMock).toHaveBeenCalledTimes(2)
  })
})
