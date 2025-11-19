import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/messages/send/route"

let messages: any[] = []
let threads: any[] = []
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
  const matchFilters = (record: any, filters: Record<string, any>) => {
    return Object.entries(filters).every(([key, value]) => {
      if (value === null) {
        return record[key] == null
      }
      return record[key] === value
    })
  }

  const createThreadQuery = () => {
    const filters: Record<string, any> = {}
    let limitCount: number | null = null
    const builder: any = {
      eq(column: string, value: any) {
        filters[column] = value
        return builder
      },
      is(column: string, value: any) {
        filters[column] = value
        return builder
      },
      limit(count?: number) {
        if (typeof count === "number") {
          limitCount = count
        }
        return builder
      },
      async maybeSingle() {
        let rows = threads.filter((thread) => matchFilters(thread, filters))
        if (typeof limitCount === "number") {
          rows = rows.slice(0, limitCount)
        }
        const row = rows[0] ?? null
        return { data: row, error: null }
      },
    }
    return builder
  }

  const createMessageQuery = () => {
    const filters: Record<string, any> = {}
    let orderColumn: string | null = null
    let ascending = true
    let limitCount: number | null = null
    const builder: any = {
      eq(column: string, value: any) {
        filters[column] = value
        return builder
      },
      order(column: string, options?: { ascending?: boolean }) {
        orderColumn = column
        ascending = options?.ascending ?? true
        return builder
      },
      limit(count: number) {
        limitCount = count
        return builder
      },
      async maybeSingle() {
        let rows = messages.filter((message) => matchFilters(message, filters))
        if (orderColumn) {
          rows = [...rows].sort((a, b) => {
            const aVal = new Date(a[orderColumn] || 0).getTime()
            const bVal = new Date(b[orderColumn] || 0).getTime()
            return ascending ? aVal - bVal : bVal - aVal
          })
        }
        if (typeof limitCount === "number") {
          rows = rows.slice(0, limitCount)
        }
        return { data: rows[0] ?? null, error: null }
      },
    }
    return builder
  }

  const client = {
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: () => ({
          data: { publicUrl: "https://cdn/storage/v1/object/public/public-media/p" },
        }),
      }),
    },
    from: (table: string) => {
      if (table === "message_threads") {
        return {
          upsert: (rows: any) => ({
            select: () => ({
              single: async () => {
                const row = Array.isArray(rows) ? rows[0] : rows
                let existing = threads.find(
                  (t) =>
                    t.buyer_id === row.buyer_id &&
                    t.phone_number === row.phone_number,
                )
                if (!existing) {
                  existing = { id: "t" + threadId++, ...row }
                  threads.push(existing)
                } else {
                  Object.assign(existing, row)
                }
                return { data: existing, error: threadError }
              },
            }),
          }),
          select: () => createThreadQuery(),
          update: (data: any) => ({
            eq: (_col: string, id: string) => ({
              select: () => ({
                single: async () => {
                  const t = threads.find((th) => th.id === id)
                  Object.assign(t || {}, data)
                  return { data: t ?? null, error: null }
                },
              }),
            }),
          }),
          insert: (rows: any) => ({
            select: () => ({
              single: async () => {
                const row = Array.isArray(rows) ? rows[0] : rows
                const t = { id: "t" + threadId++, ...row }
                threads.push(t)
                return { data: t, error: null }
              },
            }),
          }),
        }
      }
      if (table === "messages") {
        return {
          insert: async (rows: any) => {
            const arr = Array.isArray(rows) ? rows : [rows]
            const enriched = arr.map((row) => ({
              created_at: row.created_at ?? new Date().toISOString(),
              ...row,
            }))
            messages.push(...enriched)
            return { data: enriched, error: messageError }
          },
          select: () => createMessageQuery(),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { supabase: client, supabaseAdmin: client }
})

describe("messages send route", () => {
  beforeEach(() => {
    messages = []
    threads = []
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
    process.env.DEFAULT_OUTBOUND_DID = "+19998887777"
  })

  test("sends sms and records message", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ buyerId: "b1", to: "+1222", body: "hi" })
    })
    await POST(req)
    expect(fetchMock).toHaveBeenCalled()
    const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body as string)
    expect(body.from).toBe("+19998887777")
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

  test("uses preferred thread number when replying", async () => {
    threads.push({
      id: "t1",
      buyer_id: "b3",
      phone_number: "+1444",
      campaign_id: null,
      preferred_from_number: "+1888",
    })
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ buyerId: "b3", to: "+1444", body: "yo" })
    })
    await POST(req)
    const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body as string)
    expect(body.from).toBe("+1888")
  })

  test("falls back to last message when preferred is missing", async () => {
    threads.push({
      id: "t2",
      buyer_id: "b4",
      phone_number: "+1555",
      campaign_id: null,
      preferred_from_number: null,
    })
    messages.push({
      thread_id: "t2",
      direction: "inbound",
      from_number: "+1444",
      to_number: "+1666",
      created_at: new Date("2024-01-01").toISOString(),
    })
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ buyerId: "b4", to: "+1555", body: "yo" })
    })
    await POST(req)
    const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body as string)
    expect(body.from).toBe("+1666")
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
})
