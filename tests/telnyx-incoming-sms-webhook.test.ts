import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/webhooks/telnyx-incoming-sms/route"
import * as mms from "../utils/mms.server"
jest.mock("../lib/telnyx", () => ({ verifyTelnyxRequest: () => true }))

const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock

const uploadMock = jest.fn().mockResolvedValue({ data: { path: "p" }, error: null })

let buyers: any[] = []
let messages: any[] = []
let threads: any[] = []
let threadId = 1
let recipients: any[] = []

jest.mock("../lib/supabase", () => {
  const client = {

    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: () => ({ data: { publicUrl: "https://cdn/storage/v1/object/public/public-media/p" } }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null })
      })
    },
    from: (table: string) => {
      if (table === "buyers") {
        return {
          select: () => ({
            or: (expr: string) => ({
              then: async (resolve: any) => {
                const nums = expr
                  .split(",")
                  .map(s => s.split(".eq.")[1])
                const result = buyers.filter(b =>
                  nums.includes(b.phone_norm) ||
                  nums.includes(b.phone2_norm) ||
                  nums.includes(b.phone3_norm),
                )
                resolve({ data: result, error: null })
              }
            })
          }),
          update: (data: any) => ({
            in: (_col: string, ids: string[]) => {
              buyers = buyers.map(b => ids.includes(b.id) ? { ...b, ...data } : b)
              return { error: null }
            }
          })
        }
      }
      if (table === "campaign_recipients") {
        return {
          select: () => ({
            eq: (_col: string, val: any) => ({
              eq: (_c2: string, v2: any) => ({
                order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: recipients.find(r => r.buyer_id === val && r.from_number === v2) || null, error: null }) }) })
              })
            })
          })
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
                } else {
                  Object.assign(existing, row)
                }
                return { data: existing, error: null }
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
            return { data: arr, error: null }
          }
        }
      }
      throw new Error(`Unexpected table ${table}`)
    }
  }
  return { supabase: client, supabaseAdmin: client }
})

describe.skip("Telnyx incoming SMS webhook", () => {
  beforeEach(() => {
    buyers = [
      { id: "b1", phone: "2223334444", phone2: null, phone3: null, phone_norm: "2223334444", can_receive_sms: true }
    ]
    messages = []
    threads = []
    threadId = 1
    recipients = []
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
  })

  test("marks buyer as opted out on STOP", async () => {
    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+1 (222) 333-4444" },
          text: "STOP",
        },
      },
    }
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })

    await POST(req)

    expect(buyers[0].can_receive_sms).toBe(false)
    expect(messages.length).toBe(1)
    expect(messages[0]).toEqual(expect.objectContaining({ body: "STOP", is_bulk: false }))
    expect(threads.length).toBe(1)
  })

  test("uses campaign id from recipient", async () => {
    recipients.push({ buyer_id: "b1", from_number: "+1888", campaign_id: "c1" })
    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          to: [{ phone_number: "+1888" }],
          text: "hi",
        },
      },
    }
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })

    await POST(req)

    expect(threads[0]).toEqual(expect.objectContaining({ campaign_id: "c1" }))
    expect(messages[0]).toEqual(expect.objectContaining({ is_bulk: false }))
  })

  test("updates existing thread for follow-up", async () => {
    const body1 = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          text: "first",
        },
      },
    }
    const req1 = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body1) })
    await POST(req1)

    const body2 = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+1 (222) 333-4444" },
          text: "second",
        },
      },
    }
    const req2 = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body2) })
    await POST(req2)

    expect(threads.length).toBe(1)
    expect(messages.length).toBe(2)
  })

  test("revives soft-deleted thread", async () => {
    threads.push({
      id: "t1",
      buyer_id: "b1",
      phone_number: "2223334444",
      unread: false,
      campaign_id: null,
      deleted_at: "2024-01-01",
    })

    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+1 (222) 333-4444" },
          text: "hi",
        },
      },
    }
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })

    await POST(req)

    expect(threads[0].deleted_at).toBeNull()
    expect(messages.length).toBe(1)
  })

  test("matches buyer saved with +1 phone", async () => {
    buyers = [
      { id: "b1", phone: "+12223334444", phone2: null, phone3: null, phone_norm: "12223334444", can_receive_sms: true }
    ]
    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          text: "hi",
        },
      },
    }
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })
    await POST(req)
    expect(threads.length).toBe(1)
    expect(threads[0]).toEqual(expect.objectContaining({ buyer_id: "b1" }))
    expect(messages[0]).toEqual(expect.objectContaining({ buyer_id: "b1" }))
  })

  test("stores message when sender unknown", async () => {
    buyers = []
    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          text: "hi",
        },
      },
    }
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })
    await POST(req)
    expect(threads.length).toBe(1)
    expect(threads[0]).toEqual(expect.objectContaining({ buyer_id: null }))
    expect(messages.length).toBe(1)
  })

  test("saves media urls on MMS", async () => {
    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          text: "pic",
          media: [{ url: "http://x.com/img.png" }],
        },
      },
    }
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })
    await POST(req)
    expect(uploadMock).toHaveBeenCalled()
    expect(messages[0].media_urls).toEqual([
      "https://cdn/storage/v1/object/public/public-media/p",
    ])
  })

  test("handles multiple media urls", async () => {
    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          text: "pics",
          media: [{ url: "http://x.com/1.png" }, { url: "http://x.com/2.png" }],
        },
      },
    }
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })
    await POST(req)
    expect(uploadMock).toHaveBeenCalledTimes(2)
    expect(messages[0].media_urls).toEqual([
      "https://cdn/storage/v1/object/public/public-media/p",
      "https://cdn/storage/v1/object/public/public-media/p",
    ])
  })

  test("uploads media when API key provided", async () => {
    process.env.TELNYX_API_KEY = "KEY"
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("hi").buffer,
      headers: { get: () => "image/png" }
    })
    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          text: "pic",
          media: [{ url: "https://api.telnyx.com/v2/media/abc" }]
        }
      }
    }
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })
    await POST(req)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telnyx.com/v2/media/abc",
      { headers: { Authorization: "Bearer KEY" } }
    )
    expect(uploadMock).toHaveBeenCalled()
    expect(messages[0].media_urls).toEqual([
      "https://cdn/storage/v1/object/public/public-media/p",
    ])
  })

  test("mirrors Telnyx MP4 media into Supabase", async () => {
    process.env.TELNYX_API_KEY = "KEY"
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("vid").buffer,
      headers: { get: () => "video/mp4" },
    })

    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          text: "clip",
          media: [{ url: "https://api.telnyx.com/v2/media/clip.mp4" }],
        },
      },
    }

    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })

    await POST(req)

    expect(fetchMock).toHaveBeenCalledWith("https://api.telnyx.com/v2/media/clip.mp4", {
      headers: { Authorization: "Bearer KEY" },
    })
    const [path] = uploadMock.mock.calls[0]
    expect(path).toMatch(/\.mp4$/)
    expect(messages[0].media_urls?.[0]).toEqual(
      "https://cdn/storage/v1/object/public/public-media/p",
    )
    expect(messages[0].media_urls?.[0]).not.toContain("telnyx.com")
  })

  test("stores downloaded media in public-media bucket", async () => {
    process.env.TELNYX_API_KEY = "KEY"
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("hi").buffer,
      headers: { get: () => "image/jpeg" }
    })
    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          text: "pic",
          media: [{ url: "https://api.telnyx.com/v2/media/img123?foo=1" }]
        }
      }
    }
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })
    await POST(req)
    const [path, buf, opts] = uploadMock.mock.calls[0]
    expect(path).toMatch(/^incoming\/.+\.jpeg$/)
    expect(buf).toBeInstanceOf(Buffer)
    expect(opts).toEqual({ contentType: "image/jpeg", upsert: true })
    expect(messages[0].media_urls[0]).toBe(
      "https://cdn/storage/v1/object/public/public-media/p",
    )
    expect(messages[0].media_urls[0]).not.toBe(body.data.payload.media[0].url)
  })

  test("saves audio/mpeg files with mp3 extension", async () => {
    process.env.TELNYX_API_KEY = "KEY"
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("hi").buffer,
      headers: { get: () => "audio/mpeg" }
    })
    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          text: "audio",
          media: [{ url: "https://api.telnyx.com/v2/media/rec123" }]
        }
      }
    }
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })
    await POST(req)
    const [path2, buf2, opts2] = uploadMock.mock.calls[0]
    expect(path2).toMatch(/^incoming\/.+\.mp3$/)
    expect(buf2).toBeInstanceOf(Buffer)
    expect(opts2).toEqual({ contentType: "audio/mpeg", upsert: true })
    expect(messages[0].media_urls[0]).toBe(
      "https://cdn/storage/v1/object/public/public-media/p",
    )
  })

  test("converts amr media to mp3", async () => {
    const ensureSpy = jest
      .spyOn(mms, "ensurePublicMediaUrls")
      .mockResolvedValue(["https://cdn/audio.mp3"])

    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          text: "voice",
          media: [{ url: "https://api.telnyx.com/v2/media/rec.amr" }],
        },
      },
    }

    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify(body),
    })

    await POST(req)

    expect(ensureSpy).toHaveBeenCalledWith(
      ["https://api.telnyx.com/v2/media/rec.amr"],
      "incoming",
    )
    expect(messages[0].media_urls).toEqual(["https://cdn/audio.mp3"])
    expect(messages[0].media_urls[0]).not.toBe(
      body.data.payload.media[0].url,
    )

    ensureSpy.mockRestore()
  })

  test.each([
    "https://api.telnyx.com/v2/media/voice.amr",
    "https://api.telnyx.com/v2/media/voice.3gpp",
  ])("converts %s audio to mp3 via mirrorMediaUrl", async (mediaUrl) => {
    const mirrorSpy = jest
      .spyOn(mms, "mirrorMediaUrl")
      .mockResolvedValue(
        "https://cdn/storage/v1/object/public/public-media/incoming/audio.mp3",
      )

    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          text: "voice",
          media: [{ url: mediaUrl }],
        },
      },
    }

    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify(body),
    })

    try {
      await POST(req)

      expect(mirrorSpy).toHaveBeenCalledWith(mediaUrl, "incoming")
      expect(messages[0].media_urls).toEqual([
        "https://cdn/storage/v1/object/public/public-media/incoming/audio.mp3",
      ])
    } finally {
      mirrorSpy.mockRestore()
    }
  })

  test("logs error when media download fails but still returns 204", async () => {
    process.env.TELNYX_API_KEY = "KEY"
    fetchMock.mockRejectedValueOnce(new Error("fail"))
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          text: "pic",
          media: [{ url: "https://api.telnyx.com/v2/media/abc" }]
        }
      }
    }
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })
    const res = await POST(req)
    expect(errorSpy).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalled()
    expect(uploadMock).toHaveBeenCalled()
    expect(messages[0].media_urls[0]).toBe(
      "https://cdn/storage/v1/object/public/public-media/p",
    )
    expect(res.status).toBe(204)
    errorSpy.mockRestore()
  })

  test("ignores non-message events", async () => {
    const body = {
      data: {
        event_type: "foo.bar",
        payload: {},
      },
    }
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })
    const res = await POST(req)
    expect(res.status).toBe(204)
    expect(threads.length).toBe(0)
    expect(messages.length).toBe(0)
  })

  test("saves legacy media_urls payload", async () => {
    const body = {
      data: {
        event_type: "message.received",
        payload: {
          from: { phone_number: "+12223334444" },
          text: "legacy",
          media_urls: ["http://old.com/1.png"],
        },
      },
    }
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify(body) })
    await POST(req)
    expect(uploadMock).toHaveBeenCalled()
    expect(messages[0].media_urls).toEqual([
      "https://cdn/storage/v1/object/public/public-media/p",
    ])
  })
})
