import { NextRequest } from "next/server"

// Twilio SDK: only validateRequest is used by the route. Default true; individual
// tests flip it to false to exercise the 403 path.
const validateRequestMock = vi.fn(() => true)
vi.mock("twilio", () => ({
  __esModule: true,
  default: { validateRequest: validateRequestMock },
}))

// The handler imports @/lib/telnyx for the HELP auto-reply path (not exercised here).
vi.mock("../lib/telnyx", () => ({
  verifyTelnyxRequest: () => true,
  TELNYX_API_URL: "https://api.telnyx.com/v2",
  telnyxHeaders: () => ({ Authorization: "Bearer KEY" }),
}))

// Deterministic media conversion regardless of ffmpeg availability.
vi.mock("@/utils/ffmpeg-path", () => ({
  ensureFfmpegAvailable: vi.fn(async () => "/usr/bin/ffmpeg"),
}))
vi.mock("fluent-ffmpeg", () => {
  const ffmpeg = vi.fn(() => {
    const instance: any = {}
    const chain = () => instance
    Object.assign(instance, {
      inputFormat: chain,
      audioBitrate: chain,
      audioChannels: chain,
      videoCodec: chain,
      audioCodec: chain,
      format: chain,
      toFormat: chain,
      outputOptions: chain,
      size: chain,
      on: () => instance,
      pipe: (output: any) => {
        process.nextTick(() => {
          output.emit("data", Buffer.from("x"))
          output.emit("end")
        })
        return output
      },
    })
    return instance
  })
  ;(ffmpeg as any).setFfmpegPath = vi.fn()
  return { __esModule: true, default: ffmpeg }
})

const fetchMock = vi.fn()
// @ts-ignore
global.fetch = fetchMock

const uploadMock = vi.fn().mockResolvedValue({ data: { path: "p" }, error: null })

let buyers: any[] = []
let messages: any[] = []
let threads: any[] = []
let threadId = 1
let recipients: any[] = []

vi.mock("../lib/supabase", () => {
  const client = {
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: () => ({ data: { publicUrl: "https://cdn/storage/v1/object/public/public-media/p" } }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
    from: (table: string) => {
      if (table === "buyers") {
        return {
          select: () => ({
            or: (expr: string) => ({
              then: async (resolve: any) => {
                const nums = expr.split(",").map((s) => s.split(".eq.")[1])
                const result = buyers.filter(
                  (b) =>
                    nums.includes(b.phone_norm) ||
                    nums.includes(b.phone2_norm) ||
                    nums.includes(b.phone3_norm),
                )
                resolve({ data: result, error: null })
              },
            }),
          }),
          update: (data: any) => ({
            in: (_col: string, ids: string[]) => {
              buyers = buyers.map((b) => (ids.includes(b.id) ? { ...b, ...data } : b))
              return { error: null }
            },
            eq: async (_col: string, id: string) => {
              buyers = buyers.map((b) => (b.id === id ? { ...b, ...data } : b))
              return { error: null }
            },
          }),
        }
      }
      if (table === "inbound_numbers") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }),
        }
      }
      if (table === "dnc_phones") {
        return {
          upsert: async () => ({ error: null }),
          delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        }
      }
      if (table === "campaign_recipients") {
        return {
          select: () => ({
            eq: (_col: string, val: any) => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: recipients.find((r) => r.buyer_id === val) || null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
        }
      }
      if (table === "message_threads") {
        return {
          upsert: (rows: any) => ({
            select: () => ({
              single: async () => {
                const row = Array.isArray(rows) ? rows[0] : rows
                let existing = threads.find(
                  (t) => t.buyer_id === row.buyer_id && t.phone_number === row.phone_number,
                )
                if (!existing) {
                  existing = { id: "t" + threadId++, ...row }
                  threads.push(existing)
                } else {
                  Object.assign(existing, row)
                }
                return { data: existing, error: null }
              },
            }),
          }),
          select: () => ({
            eq: (_col: string, phone: string) => ({
              is: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: threads.find((t) => !t.buyer_id && t.phone_number === phone) || null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: (data: any) => ({
            eq: (_col: string, id: string) => ({
              select: () => ({
                single: async () => {
                  const t = threads.find((th) => th.id === id)
                  Object.assign(t || {}, data)
                  return { data: t, error: null }
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
            messages.push(...arr)
            return { data: arr, error: null }
          },
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { supabase: client, supabaseAdmin: client }
})

const { POST } = await import("../app/api/webhooks/twilio-incoming-sms/route")

function twilioReq(fields: Record<string, string>) {
  return new NextRequest("http://test/api/webhooks/twilio-incoming-sms", {
    method: "POST",
    body: new URLSearchParams(fields).toString(),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": "sig",
    },
  })
}

describe("Twilio incoming SMS webhook", () => {
  beforeEach(() => {
    buyers = [
      { id: "b1", phone: "2223334444", phone2: null, phone3: null, phone_norm: "2223334444", can_receive_sms: true },
    ]
    messages = []
    threads = []
    threadId = 1
    recipients = []
    validateRequestMock.mockReset().mockReturnValue(true)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("hi").buffer,
      headers: { get: () => "image/png" },
    })
    uploadMock.mockReset()
    uploadMock.mockResolvedValue({ data: { path: "p" }, error: null })
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://cdn"
    process.env.TELNYX_API_KEY = "KEY"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "SKEY"
    process.env.LISTHIT_TWILIO_AUTH_TOKEN = "AUTH"
  })

  test("plain inbound inserts an inbound message with provider_id = MessageSid and replies TwiML", async () => {
    const res = await POST(
      twilioReq({ From: "+12223334444", To: "+18885551234", Body: "hi", MessageSid: "SM123" }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("text/xml")
    const xml = await res.text()
    expect(xml).toContain("<Response></Response>")

    expect(messages.length).toBe(1)
    expect(messages[0]).toEqual(
      expect.objectContaining({ direction: "inbound", provider_id: "SM123", body: "hi", buyer_id: "b1" }),
    )
    expect(threads.length).toBe(1)
  })

  test("MMS passes both media URLs through the media pipeline", async () => {
    await POST(
      twilioReq({
        From: "+12223334444",
        To: "+18885551234",
        Body: "pics",
        MessageSid: "SM124",
        NumMedia: "2",
        MediaUrl0: "https://api.twilio.com/media/1",
        MediaUrl1: "https://api.twilio.com/media/2",
      }),
    )
    expect(uploadMock).toHaveBeenCalledTimes(2)
    expect(messages[0].media_urls).toEqual([
      "https://cdn/storage/v1/object/public/public-media/p",
      "https://cdn/storage/v1/object/public/public-media/p",
    ])
  })

  test("signature failure → 403 and no DB writes", async () => {
    validateRequestMock.mockReturnValue(false)
    const res = await POST(
      twilioReq({ From: "+12223334444", To: "+18885551234", Body: "hi", MessageSid: "SM125" }),
    )
    expect(res.status).toBe(403)
    expect(messages.length).toBe(0)
    expect(threads.length).toBe(0)
  })

  test("missing auth token → 403 fail-closed", async () => {
    delete process.env.LISTHIT_TWILIO_AUTH_TOKEN
    const res = await POST(
      twilioReq({ From: "+12223334444", To: "+18885551234", Body: "hi", MessageSid: "SM126" }),
    )
    expect(res.status).toBe(403)
    expect(messages.length).toBe(0)
  })

  test("STOP flows through the shared opt-keyword handling (buyer opted out)", async () => {
    const res = await POST(
      twilioReq({ From: "+1 (222) 333-4444", To: "+18885551234", Body: "STOP", MessageSid: "SM127" }),
    )
    expect(res.status).toBe(200)
    expect(buyers[0].can_receive_sms).toBe(false)
    expect(messages.length).toBe(1)
    expect(messages[0]).toEqual(expect.objectContaining({ body: "STOP", direction: "inbound" }))
  })
})
