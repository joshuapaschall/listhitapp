import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"

const fetchMock = jest.fn()
const ensureMock = jest.fn(async (urls: string[]) => urls)
let insertedRow: any = null

// @ts-ignore
global.fetch = fetchMock

jest.unstable_mockModule("@/utils/mms.server", () => ({
  ensurePublicMediaUrls: (...args: any[]) => ensureMock(...args),
}))

jest.unstable_mockModule("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "messages") throw new Error(`Unexpected table ${table}`)
      return {
        insert: (row: any) => ({
          select: () => ({
            single: async () => {
              insertedRow = row
              return {
                data: { id: "db1", created_at: "2024-01-01T00:00:00.000Z" },
                error: null,
              }
            },
          }),
        }),
      }
    },
  },
  supabaseAdmin: {},
}))

describe("messages schedule route", () => {
  beforeEach(() => {
    jest.resetModules()
    fetchMock.mockReset()
    ensureMock.mockClear()
    insertedRow = null
    process.env.TELNYX_API_KEY = "test-key"
    process.env.TELNYX_MESSAGING_PROFILE_ID = "profile"
  })

  test("sends scheduled payload to telnyx and records message", async () => {
    const sendAt = "2024-01-01T12:30:00.000Z"
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { id: "telnyx-123" } }),
    })

    const mod = await import("@/app/api/messages/schedule/route")
    const req = new NextRequest("http://localhost/api/messages/schedule", {
      method: "POST",
      body: JSON.stringify({
        buyerId: "buyer-1",
        threadId: "thread-1",
        to: "+12223334444",
        from: "+15556667777",
        body: "Hello world",
        mediaUrls: ["http://cdn.test/img.jpg"],
        sendAt,
      }),
    })

    const res = await mod.POST(req)

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/messages/schedule"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(sendAt),
      }),
    )
    const payload = JSON.parse((fetchMock.mock.calls[0]?.[1] as any).body)
    expect(payload).toMatchObject({
      from: "+15556667777",
      to: "+12223334444",
      text: "Hello world",
      send_at: sendAt,
      type: "MMS",
    })
    expect(payload.media_urls).toEqual(["http://cdn.test/img.jpg"])
    expect(ensureMock).toHaveBeenCalledWith(["http://cdn.test/img.jpg"], "outgoing")
    expect(insertedRow).toMatchObject({
      thread_id: "thread-1",
      buyer_id: "buyer-1",
      status: "scheduled",
      provider_id: "telnyx-123",
    })
  })
})
