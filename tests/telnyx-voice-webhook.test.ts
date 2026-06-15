import { NextRequest } from "next/server"

import { POST } from "../app/api/webhooks/telnyx-voice/route"

const fetchMock = vi.fn()
const originalFetch = global.fetch
// @ts-ignore
global.fetch = fetchMock

const { supabaseAdminMock } = vi.hoisted(() => {
  // A chainable query builder whose terminals resolve to empty data.
  const buildChain = () => {
    const chain: any = {
      select: () => chain,
      or: () => chain,
      eq: () => chain,
      gt: () => chain,
      not: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
      then: (resolve: any) => resolve({ data: [], error: null }),
    }
    return chain
  }

  return {
    supabaseAdminMock: {
      from: vi.fn((table: string) => {
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

        if (table === "calls") {
          return {
            upsert: async () => ({ data: null, error: null }),
            update: () => ({ eq: async () => ({ data: null, error: null }) }),
            select: () => buildChain(),
          }
        }

        if (table === "buyers") {
          return { select: () => buildChain() }
        }

        throw new Error(`Unexpected table ${table}`)
      }),
    },
  }
})

const startVoicemailMock = vi.hoisted(() => vi.fn(async () => {}))

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: supabaseAdminMock }))
vi.mock("@/lib/voice/routing", () => ({
  getRoutingConfig: async () => ({
    routingMode: "browser_only",
    forwardingNumber: null,
    browserRingTimeoutSeconds: 20,
  }),
}))
vi.mock("@/lib/voice/webrtc-sip", () => ({
  getWebRTCSipUri: async () => "sip:listhitapp@sip.telnyx.com",
}))
vi.mock("@/lib/voice/voicemail", () => ({ startVoicemail: startVoicemailMock }))

describe("telnyx voice webhook", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    supabaseAdminMock.from.mockClear()
    startVoicemailMock.mockClear()
    process.env.TELNYX_API_KEY = "test-key"
    process.env.FALLBACK_AGENT_SIP_USERNAME = "fallback_agent"
    // The route verifies the Telnyx Ed25519 signature before processing; bypass
    // it in tests (these requests carry no signature header).
    process.env.SKIP_TELNYX_SIG = "1"
  })

  afterAll(() => {
    // @ts-ignore
    global.fetch = originalFetch
    delete process.env.TELNYX_API_KEY
    delete process.env.FALLBACK_AGENT_SIP_USERNAME
    delete process.env.SKIP_TELNYX_SIG
  })

  test("ignores non initiated events", async () => {
    const body = { data: { event_type: "call.answered", payload: {} } }
    const req = new NextRequest("http://localhost", { method: "POST", body: JSON.stringify(body) })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("answers and transfers inbound call", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const body = {
      data: {
        event_type: "call.initiated",
        payload: { call_control_id: "abc123", to: "+15551234567", direction: "incoming" },
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
        body: expect.stringContaining("sip:listhitapp@sip.telnyx.com"),
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
        payload: { call_control_id: "abc999", to: "+15558675309", direction: "incoming" },
      },
    }
    const req = new NextRequest("http://localhost", { method: "POST", body: JSON.stringify(body) })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload).toEqual({ ok: true })

    // Assert the intent rather than a brittle call sequence: the call is
    // answered, a transfer to the browser SIP URI is attempted, and when it
    // fails the route falls back to voicemail.
    const calledUrls = fetchMock.mock.calls.map((c) => c[0] as string)
    expect(calledUrls).toContain("https://api.telnyx.com/v2/calls/abc999/actions/answer")
    expect(
      calledUrls.filter((u) => u === "https://api.telnyx.com/v2/calls/abc999/actions/transfer").length,
    ).toBeGreaterThanOrEqual(1)
    expect(startVoicemailMock).toHaveBeenCalled()
  })
})
