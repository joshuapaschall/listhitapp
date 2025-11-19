import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/messages/send/route"

let messages: any[] = []
let threads: any[] = []
let buyerSmsSenders: any[] = []
let threadId = 1
let threadError: any = null
let messageError: any = null
const fetchMock = jest.fn()
const uploadMock = jest.fn().mockResolvedValue({ data: { path: "p" }, error: null })
// @ts-ignore
global.fetch = fetchMock

jest.mock("../lib/sms-rate-limiter", () => ({
  scheduleSMS: jest.fn((_c: string, _b: string, fn: () => Promise<any>) => fn()),
  lookupCarrier: jest.fn(async () => "verizon"),
}))

jest.mock("../lib/supabase", () => {
  const client = {

    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: () => ({ data: { publicUrl: "https://cdn/storage/v1/object/public/public-media/p" } })
      })
    },
    from: (table: string) => {
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
                return { data: existing, error: threadError }
              }
            })
          }),
          select: () => ({
            eq: (_col: string, phone: string) => ({
              is: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: threads.find(t => !t.buyer_id && t.phone_number === phone) || null,
                    error: null
                  })
                })
              })
            })
          }),
          update: (data: any) => ({
            eq: (_col: string, id: string) => ({
              select: () => ({
                single: async () => {
                  const t = threads.find(th => th.id === id)
                  Object.assign(t || {}, data)
                  return { data: t, error: null }
                }
              })
            })
          }),
          insert: (rows: any) => ({
            select: () => ({
              single: async () => {
                const row = Array.isArray(rows) ? rows[0] : rows
                const t = { id: "t" + threadId++, ...row }
                threads.push(t)
                return { data: t, error: null }
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
            return { data: arr, error: messageError }
          }
        }
      }
      if (table === "buyer_sms_senders") {
        return {
          select: () => ({
            eq: (_col: string, val: any) => ({
              maybeSingle: async () => ({
                data: buyerSmsSenders.find((row) => row.buyer_id === val) || null,
                error: null,
              })
            })
          }),
          upsert: async (payload: any) => {
            const rows = Array.isArray(payload) ? payload : [payload]
            for (const row of rows) {
              const existing = buyerSmsSenders.find((s) => s.buyer_id === row.buyer_id)
              if (existing) {
                existing.from_number = row.from_number
              } else {
                buyerSmsSenders.push({ buyer_id: row.buyer_id, from_number: row.from_number })
              }
            }
            return { data: rows, error: null }
          }
        }
      }
      throw new Error(`Unexpected table ${table}`)
    }
  }
  return { supabase: client, supabaseAdmin: client }
})

describe("messages send route", () => {
  beforeEach(() => {
    messages = []
    threads = []
    buyerSmsSenders = []
    threadId = 1
    threadError = null
    messageError = null
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "SM1", from: "+1555" } }),
      arrayBuffer: async () => new ArrayBuffer(1),
      headers: { get: () => "image/jpeg" },
    })
    uploadMock.mockReset()
    uploadMock.mockResolvedValue({ data: { path: "p" }, error: null })
    process.env.TELNYX_API_KEY = "KEY"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://cdn"
    process.env.TELNYX_MESSAGING_PROFILE_ID = "MP"
  })

  test("sends sms and records message", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ buyerId: "b1", to: "+1222", body: "hi" })
    })
    await POST(req)
    expect(fetchMock).toHaveBeenCalled()
    expect(messages.length).toBe(1)
    expect(messages[0].is_bulk).toBe(false)
    expect(messages[0].media_urls).toBeNull()
    expect(threads.length).toBe(1)
  })

  test("sends sms without buyer id", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ to: "+1222", body: "hi" })
    })
    await POST(req)
    expect(fetchMock).toHaveBeenCalled()
    expect(messages[0].buyer_id).toBeNull()
    expect(messages[0].media_urls).toBeNull()
    expect(threads[0].buyer_id).toBeNull()
  })

  test("sends mms with only mediaUrls", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({
        to: "+1222",
        body: "",
        mediaUrls: ["http://img.com/pic.jpg"],
      })
    })
    await POST(req)
    expect(uploadMock).toHaveBeenCalled()
    const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body as string)
    expect(body.media_urls).toEqual(["https://cdn/storage/v1/object/public/public-media/p"])
    expect(messages[0].media_urls).toEqual(["https://cdn/storage/v1/object/public/public-media/p"])
    expect(threads.length).toBe(1)
  })

  test("reuses anon thread for multiple messages", async () => {
    const req1 = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ to: "+1222", body: "hi" })
    })
    await POST(req1)
    const req2 = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ to: "+1222", body: "again" })
    })
    await POST(req2)
    expect(threads.length).toBe(1)
    expect(messages.length).toBe(2)
    expect(messages[0].thread_id).toBe(threads[0].id)
    expect(messages[1].thread_id).toBe(threads[0].id)
    expect(messages[0].media_urls).toBeNull()
    expect(messages[1].media_urls).toBeNull()
  })

  test("reuses anon thread when buyerId is null", async () => {
    const req1 = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ buyerId: null, to: "+1222", body: "hi" })
    })
    await POST(req1)
    const req2 = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ buyerId: null, to: "+1222", body: "again" })
    })
    await POST(req2)
    expect(threads.length).toBe(1)
    expect(messages.length).toBe(2)
    expect(messages[0].thread_id).toBe(threads[0].id)
    expect(messages[1].thread_id).toBe(threads[0].id)
    expect(messages[0].media_urls).toBeNull()
    expect(messages[1].media_urls).toBeNull()
  })

  test("returns error message", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ errors: [{ detail: "Carrier violation" }] }),
    })
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ buyerId: "b1", to: "+1222", body: "hi" })
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(500)
    expect(data.error).toContain("Carrier violation")
  })

  test("handles upsert error", async () => {
    threadError = new Error("db fail")
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ buyerId: "b1", to: "+1222", body: "hi" })
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe("Database error")
  })

  test("handles insert error", async () => {
    messageError = new Error("insert fail")
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ buyerId: "b1", to: "+1222", body: "hi" })
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe("Database error")
  })

  test("formats phone numbers to E.164", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ buyerId: "b2", to: "3334445555", body: "hi" })
    })
    await POST(req)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.to).toBe("+13334445555")
  })

  test("stores from_number as string", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "SMX", from: { phone_number: "+1888" } } }),
      arrayBuffer: async () => new ArrayBuffer(1),
      headers: { get: () => "image/jpeg" },
    })
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ to: "+1222", body: "hi" })
    })
    await POST(req)
    expect(typeof messages[0].from_number).toBe("string")
    expect(messages[0].from_number).toBe("+1888")
  })

  test("uses sticky from number when available", async () => {
    buyerSmsSenders.push({ buyer_id: "b1", from_number: "+1999" })
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ buyerId: "b1", to: "+1222", body: "hi" })
    })
    await POST(req)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.from).toBe("+1999")
    expect(buyerSmsSenders).toHaveLength(1)
    expect(buyerSmsSenders[0].from_number).toBe("+1999")
  })

  test("persists sticky sender after send", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ buyerId: "b2", to: "+1222", body: "hi" })
    })
    await POST(req)
    expect(buyerSmsSenders).toEqual([{ buyer_id: "b2", from_number: "+1555" }])
  })
})
