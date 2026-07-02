// Drives handleInboundSms directly with HELP-intent events to exercise the
// provider-aware HELP auto-reply: the Telnyx arm keeps the raw Telnyx fetch; the
// Twilio arm resolves the org from inbound_numbers and sends via the provider
// abstraction. Neither arm may ever 500.

const h = vi.hoisted(() => {
  const state = {
    buyers: [] as any[],
    messages: [] as any[],
    inboundOrg: "org-x" as string | null,
    inboundQueries: 0,
  }
  const client = {
    from: (table: string) => {
      if (table === "buyers") {
        return { select: () => ({ or: () => Promise.resolve({ data: state.buyers, error: null }) }) }
      }
      if (table === "campaign_recipients") {
        return {
          select: () => ({
            eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      if (table === "inbound_numbers") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => {
                  state.inboundQueries++
                  return { data: state.inboundOrg ? { org_id: state.inboundOrg } : null, error: null }
                },
              }),
            }),
          }),
        }
      }
      if (table === "message_threads") {
        return {
          upsert: () => ({ select: () => ({ single: async () => ({ data: { id: "t1" }, error: null }) }) }),
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { filtered_at: null, filter_overridden: false }, error: null }) }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      if (table === "messages") {
        return {
          insert: async (rows: any) => {
            const arr = Array.isArray(rows) ? rows : [rows]
            state.messages.push(...arr)
            return { data: arr, error: null }
          },
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { state, client, resolveMock: vi.fn(), sendMock: vi.fn() }
})

vi.mock("@/lib/supabase", () => ({ supabase: h.client, supabaseAdmin: h.client }))
vi.mock("@/lib/providers/sms", () => ({ resolveSmsProvider: h.resolveMock }))
vi.mock("@/lib/telnyx", () => ({
  TELNYX_API_URL: "https://api.telnyx.com/v2",
  telnyxHeaders: () => ({ Authorization: "Bearer KEY" }),
}))
vi.mock("@/lib/sms/negative-keywords", () => ({ matchNegativeKeyword: async () => null }))
vi.mock("@/lib/sms/suppress", () => ({ suppressBuyerSms: async () => {} }))
vi.mock("@/lib/dnc/phones", () => ({ recordDncPhone: async () => {} }))
vi.mock("@/services/thread-utils", () => ({
  upsertAnonThread: async () => ({ data: { id: "t-anon" }, error: null }),
}))
vi.mock("@/utils/mms.server", () => ({ ensurePublicMediaUrls: async (u: string[]) => u }))

const fetchMock = vi.fn()
// @ts-ignore
global.fetch = fetchMock

import { handleInboundSms } from "@/lib/sms/inbound-handler"

const helpEvent = (provider: "telnyx" | "twilio") => ({
  provider,
  from: "+12223334444", // buyer
  to: "+18885551234", // org DID
  text: "HELP",
  rawMediaUrls: [] as string[],
  providerId: "IN1",
})

describe("provider-aware HELP auto-reply", () => {
  beforeEach(() => {
    h.state.buyers = [
      { id: "b1", org_id: "org-1", can_receive_sms: true, blocked_at: null, phone_norm: "12223334444" },
    ]
    h.state.messages = []
    h.state.inboundOrg = "org-x"
    h.state.inboundQueries = 0
    h.resolveMock.mockReset().mockResolvedValue({
      name: "twilio",
      managesPacing: true,
      sendMessage: h.sendMock,
    })
    h.sendMock.mockReset().mockResolvedValue({ id: "tw1", from: "+18885551234" })
    fetchMock.mockReset().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "tlx1" } }),
      text: async () => "",
    })
    process.env.TELNYX_MESSAGING_PROFILE_ID = "MP"
    delete process.env.SMS_HELP_AUTO_REPLY
  })

  test("telnyx HELP uses the raw Telnyx fetch, not the provider abstraction", async () => {
    const res = await handleInboundSms(helpEvent("telnyx"))
    expect(res.status).toBe(204)
    expect(fetchMock).toHaveBeenCalled()
    expect(h.resolveMock).not.toHaveBeenCalled()
    const reply = h.state.messages.find((m) => m.direction === "outbound")
    expect(reply).toBeTruthy()
    expect(reply.provider_id).toBe("tlx1")
  })

  test("twilio HELP resolves the org from inbound_numbers and sends via the provider", async () => {
    const res = await handleInboundSms(helpEvent("twilio"))
    expect(res.status).toBe(204)
    expect(h.state.inboundQueries).toBeGreaterThan(0)
    expect(h.resolveMock).toHaveBeenCalledWith("org-x")
    expect(h.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: "+18885551234", to: "+12223334444" }),
    )
    expect(h.sendMock.mock.calls[0][0].text).toContain("STOP")
    expect(fetchMock).not.toHaveBeenCalled()
    const reply = h.state.messages.find((m) => m.direction === "outbound")
    expect(reply.provider_id).toBe("tw1")
  })

  test("twilio HELP with no inbound_numbers match warns and skips (response unchanged)", async () => {
    h.state.inboundOrg = null
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const res = await handleInboundSms(helpEvent("twilio"))
    expect(res.status).toBe(204)
    expect(h.resolveMock).not.toHaveBeenCalled()
    expect(h.sendMock).not.toHaveBeenCalled()
    expect(h.state.messages.find((m) => m.direction === "outbound")).toBeUndefined()
    warn.mockRestore()
  })

  test("twilio HELP never 500s when sendMessage throws", async () => {
    h.sendMock.mockRejectedValueOnce(new Error("twilio down"))
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await handleInboundSms(helpEvent("twilio"))
    expect(res.status).toBe(204)
    expect(h.state.messages.find((m) => m.direction === "outbound")).toBeUndefined()
    err.mockRestore()
  })
})
