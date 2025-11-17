import { describe, beforeEach, afterAll, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"

import { POST } from "../app/api/webhooks/telnyx-voice/route"

const fetchMock = jest.fn()
const originalFetch = global.fetch
// @ts-ignore
global.fetch = fetchMock

const supabaseAdminMock = {
  from: jest.fn((table: string) => {
    if (table === "inbound_numbers") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { org_id: "org-1" }, error: null }) }),
          }),
        }),
      }
    }

    if (table === "agents_sessions") {
      return {
        select: () => ({
          eq: () => ({
            gt: () => ({
              order: () => ({
                limit: () => ({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }
    }

    if (table === "org_voice_settings") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { fallback_mode: "dispatcher_sip", fallback_sip_username: "sip_agent_1" },
              error: null,
            }),
          }),
        }),
      }
    }

    if (table === "agents") {
      return {
        select: () => ({
          eq: () => ({
            not: () => ({
              single: async () => ({ data: { id: "agent-1", sip_username: "sip_agent_1" }, error: null }),
            }),
          }),
        }),
      }
    }

    throw new Error(`Unexpected table ${table}`)
  }),
}

jest.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: supabaseAdminMock }))

describe("telnyx voice webhook", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    supabaseAdminMock.from.mockClear()
    process.env.TELNYX_API_KEY = "test-key"
    process.env.FALLBACK_AGENT_SIP_USERNAME = "fallback_agent"
  })

  afterAll(() => {
    // @ts-ignore
    global.fetch = originalFetch
    delete process.env.TELNYX_API_KEY
    delete process.env.FALLBACK_AGENT_SIP_USERNAME
  })

  test("ignores non initiated events", async () => {
    const body = { data: { event_type: "call.answered", payload: {} } }
    const req = new NextRequest("http://localhost", { method: "POST", body: JSON.stringify(body) })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload).toEqual({ ok: true, ignored: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("answers and transfers inbound call", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const body = {
      data: {
        event_type: "call.initiated",
        payload: { call_control_id: "abc123", to: "+15551234567" },
      },
    }
    const req = new NextRequest("http://localhost", { method: "POST", body: JSON.stringify(body) })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload).toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.telnyx.com/v2/calls/abc123/actions/answer",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.telnyx.com/v2/calls/abc123/actions/transfer",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ to: "sip:sip_agent_1@sip.telnyx.com", from: "+15551234567" }),
      }),
    )
  })

  test("falls back to voicemail when transfer fails", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 422, text: async () => "not answered yet" })
      .mockResolvedValueOnce({ ok: false, status: 422, text: async () => "not answered yet" })
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => "bad request" })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const body = {
      data: {
        event_type: "call.initiated",
        payload: { call_control_id: "abc999", to: "+15558675309" },
      },
    }
    const req = new NextRequest("http://localhost", { method: "POST", body: JSON.stringify(body) })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload).toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.telnyx.com/v2/calls/abc999/actions/speak",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "https://api.telnyx.com/v2/calls/abc999/actions/hangup",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
