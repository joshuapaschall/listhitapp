import { describe, expect, test, beforeEach } from "@jest/globals"
let sendCampaignSMS: any

let mappings: any[] = []
let messages: any[] = []
let threads: any[] = []
let threadId = 1
const fetchMock = jest.fn()
const uploadMock = jest.fn().mockResolvedValue({ data: { path: "p" }, error: null })
// @ts-ignore
global.fetch = fetchMock

jest.mock("../lib/sms-rate-limiter", () => {
  return {
    scheduleSMS: jest.fn((_carrier: string, _body: string, fn: () => Promise<any>) => fn()),
    lookupCarrier: jest.fn(async () => "verizon"),
  }
})

jest.mock("../lib/supabase", () => {
  const client = {
      storage: { from: () => ({ upload: uploadMock, getPublicUrl: () => ({ data: { publicUrl: "https://cdn/storage/v1/object/public/public-media/p" } }) }) },
      from: (table: string) => {
        if (table === "buyer_sms_senders") {
          return {
            select: () => ({
              eq: (_col: string, value: string) => ({
                maybeSingle: async () => {
                  const row = mappings.find((r) => r.buyer_id === value)
                  return row ? { data: row, error: null } : { data: null, error: null }
                },
              }),
            }),
            insert: (rows: any[]) => {
              mappings.push(...rows)
              return { data: rows, error: null }
            },
          }
        }
        if (table === "message_threads") {
          return {
            upsert: (rows: any) => ({
              select: () => ({
                single: async () => {
                  const row = Array.isArray(rows) ? rows[0] : rows
                  let existing = threads.find(
                    t =>
                      t.buyer_id === row.buyer_id &&
                      t.phone_number === row.phone_number,
                  )
                  if (!existing) {
                    existing = { id: "t" + threadId++, ...row }
                    threads.push(existing)
                  }
                  return { data: existing, error: null }
                }
              })
            })
          }
        }
        if (table === "messages") {
          return {
            insert: async (rows: any) => {
              const arr = Array.isArray(rows) ? rows : [rows]
              messages.push(...arr)
              return { data: arr, error: null }
            }
          }
        }
        throw new Error(`Unexpected table ${table}`)
      },
    }
  return { supabase: client, supabaseAdmin: client }
})

describe("sendCampaignSMS sticky sender", () => {
  beforeEach(() => {
    mappings = []
    messages = []
    threads = []
    threadId = 1
    fetchMock.mockClear()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "SM1", from: "+1555" } }),
      arrayBuffer: async () => new ArrayBuffer(1),
      headers: { get: () => "image/jpeg" },
    })
    uploadMock.mockReset()
    uploadMock.mockResolvedValue({ data: { path: "p" }, error: null })
    process.env.TELNYX_API_KEY = "KEY123"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://cdn"
    process.env.TELNYX_MESSAGING_PROFILE_ID = "MP123"
    jest.resetModules()
    sendCampaignSMS = require("../services/campaign-sender.server").sendCampaignSMS
  })

  test("uses stored number when mapping exists", async () => {
    mappings.push({ buyer_id: "b1", from_number: "+1999" })
    await sendCampaignSMS({ buyerId: "b1", to: ["+1222"], body: "hi" })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.from).toBe("+1999")
    expect(body.messaging_profile_id).toBe("MP123")
    expect(mappings.length).toBe(1)
  })

  test("stores number when mapping missing", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: "SM2", from: "+1444" } }) })
    await sendCampaignSMS({ buyerId: "b2", to: ["+1333"], body: "test" })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.messaging_profile_id).toBe("MP123")
    expect(mappings.length).toBe(1)
    expect(mappings[0]).toEqual({ buyer_id: "b2", from_number: "+1444" })
  })

  test("includes media URLs when provided", async () => {
    await sendCampaignSMS({ buyerId: "b3", to: ["+1444"], body: "pic", mediaUrls: ["http://x.com/img.png"] })
    const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body as string)
    expect(uploadMock).toHaveBeenCalled()
    expect(body.media_urls).toContain("https://cdn/storage/v1/object/public/public-media/p")
    expect(messages[0].media_urls).toContain("https://cdn/storage/v1/object/public/public-media/p")
  })

  test("handles multiple media URLs", async () => {
    await sendCampaignSMS({
      buyerId: "b6",
      to: ["+1555"],
      body: "pics",
      mediaUrls: ["http://x.com/1.png", "http://x.com/2.png"],
    })
    const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body as string)
    expect(uploadMock).toHaveBeenCalledTimes(2)
    expect(body.media_urls.length).toBe(2)
    expect(body.media_urls[0]).toBe("https://cdn/storage/v1/object/public/public-media/p")
    expect(body.media_urls[1]).toBe("https://cdn/storage/v1/object/public/public-media/p")
    expect(messages[0].media_urls).toEqual([
      "https://cdn/storage/v1/object/public/public-media/p",
      "https://cdn/storage/v1/object/public/public-media/p",
    ])
  })

  test("sends to multiple numbers", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { id: "SM3", from: "+1666" } }) })
    await sendCampaignSMS({ buyerId: "b4", to: ["+1111", "+2222"], body: "multi" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test("inserts sticky sender once for batch", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { id: "SM4", from: "+1777" } }) })
    await sendCampaignSMS({ buyerId: "b5", to: ["+3333", "+4444"], body: "reuse" })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    const second = JSON.parse(fetchMock.mock.calls[1][1].body as string)
    expect(first.messaging_profile_id).toBe("MP123")
    expect(second.from).toBe("+1777")
    expect(second.messaging_profile_id).toBe("MP123")
    expect(mappings.length).toBe(1)
  })

  test("records messages with bulk flag", async () => {
    await sendCampaignSMS({ buyerId: "b6", to: ["+1555"], body: "hello", campaignId: "c1" })
    expect(messages.length).toBe(1)
    expect(messages[0]).toEqual(
      expect.objectContaining({ is_bulk: true, body: "hello", media_urls: null })
    )
    expect(threads.length).toBe(1)
    expect(threads[0]).toEqual(expect.objectContaining({ campaign_id: "c1" }))
  })

  test("formats phone numbers to E.164", async () => {
    await sendCampaignSMS({ buyerId: "b7", to: ["2223334444"], body: "test" })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.to).toBe("+12223334444")
  })

  test("normalizes stored callerId", async () => {
    mappings.push({ buyer_id: "b8", from_number: "15554443333" })
    await sendCampaignSMS({ buyerId: "b8", to: ["+1555"], body: "hey" })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.from).toBe("+15554443333")
  })

  test("stores from_number as string", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "SMY", from: { phone_number: "+1777" } } }),
    })
    await sendCampaignSMS({ buyerId: "b9", to: ["+1222"], body: "hi" })
    expect(typeof messages[0].from_number).toBe("string")
    expect(messages[0].from_number).toBe("+1777")
  })
})
