import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/campaigns/send/route"
import { POST as SendfoxPOST } from "../app/api/sendfox/contact/route"

let campaigns: any[] = []
let recipients: any[] = []
let buyers: any[] = []
let smsMock = jest.fn()
let supabase: any
let authUser: any = null
let fetchMock = jest.fn()
let recipientCounter = 1

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => supabase,
}))

jest.mock("../services/campaign-sender.server", () => ({
  sendCampaignSMS: (...args: any[]) => smsMock(...args),
}))
jest.mock("../services/campaign-sender", () => ({
  sendEmailCampaign: jest.fn(),
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
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
        }
      }
      if (table === "buyers") {
        return {
          select: () => ({
            in: (_c: string, vals: any[]) => ({
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
    auth: {
      getUser: async () => ({ data: { user: authUser }, error: null }),
    },
  }
}

describe("send route auth", () => {
  beforeEach(() => {
    campaigns = []
    recipients = []
    buyers = []
    smsMock.mockReset()
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
    ;(global as any).fetch = fetchMock
    authUser = null
    recipientCounter = 1
    supabase = buildSupabase()
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://local"
  })

  test("returns 403 when user not owner", async () => {
    campaigns.push({ id: "c1", user_id: "u1", channel: "sms", message: "Hi", buyer_ids: ["b1"] })
    buyers.push({ id: "b1", phone: "+1222", can_receive_sms: true, sendfox_hidden: false })
    authUser = { id: "u2" }
    const req = new NextRequest("http://test", {
      method: "POST",
      headers: { Authorization: "Bearer user" },
      body: JSON.stringify({ campaignId: "c1" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  test("allows owner token", async () => {
    campaigns.push({ id: "c2", user_id: "u2", channel: "sms", message: "Yo", buyer_ids: ["b2"] })
    buyers.push({ id: "b2", phone: "+1444", can_receive_sms: true, sendfox_hidden: false })
    authUser = { id: "u2" }
    smsMock.mockResolvedValue([{ sid: "1", from: "+1555" }])
    const req = new NextRequest("http://test", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ campaignId: "c2" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(smsMock).toHaveBeenCalled()
  })
})

describe("sendfox contact auth", () => {
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
    ;(global as any).fetch = fetchMock
  })

  test("returns 401 when token missing", async () => {
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
