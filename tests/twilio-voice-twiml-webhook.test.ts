import { NextRequest } from "next/server"
import { buildVoiceIdentity } from "@/lib/providers/voice/identity"

// Keep the real twilio.twiml.VoiceResponse (so we assert real TwiML) but stub
// validateRequest.
const h = vi.hoisted(() => ({
  validateMock: vi.fn(() => true),
  loadRoutingStateMock: vi.fn(),
  createMock: vi.fn(),
  clientForOrg: vi.fn(),
  inserted: [] as any[],
  updates: [] as any[],
}))

vi.mock("twilio", async (importOriginal) => {
  const actual: any = await importOriginal()
  const d = actual.default
  return { ...actual, default: { ...d, validateRequest: h.validateMock } }
})

// Phase 2A: every Twilio webhook verifies through verifyTwilioWebhook. The
// existing validateMock still decides pass/fail; vw.orgId is the org proven by
// the signing subaccount (null = parent account, no org claim).
const vw = vi.hoisted(() => ({ orgId: null as string | null }))
vi.mock("@/lib/twilio/verify-webhook", () => ({
  verifyTwilioWebhook: async (input: any) =>
    (h.validateMock as any)(input)
      ? vw.orgId
        ? { ok: true, accountSid: "ACsub", account: "subaccount", orgId: vw.orgId }
        : { ok: true, accountSid: "ACparent", account: "parent", orgId: null }
      : { ok: false, reason: "bad_signature" },
}))

vi.mock("@/lib/providers/routing-state", () => ({ loadRoutingState: h.loadRoutingStateMock }))
// The prospect dial-in uses the org's own subaccount client.
vi.mock("@/lib/twilio/org-client", () => ({ getTwilioClientForOrg: h.clientForOrg }))
vi.mock("@/lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "calls") {
        return {
          insert: async (row: any) => {
            h.inserted.push(row)
            return { error: null }
          },
          update: (u: any) => {
            h.updates.push(u)
            return { eq: async () => ({ error: null }) }
          },
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { supabase: client, supabaseAdmin: client }
})

const { POST } = await import("../app/api/webhooks/twilio-voice-twiml/route")

const ORG = "11111111-1111-1111-1111-111111111111"
const USER = "22222222-2222-2222-2222-222222222222"
const IDENTITY = buildVoiceIdentity(ORG, USER)
const ROOM = "lh_CA1"

function req(fields: Record<string, string>) {
  return new NextRequest("http://test/api/webhooks/twilio-voice-twiml", {
    method: "POST",
    body: new URLSearchParams(fields).toString(),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": "sig",
    },
  })
}

describe("twilio voice TwiML webhook (conference model)", () => {
  beforeEach(() => {
    h.validateMock.mockReset().mockReturnValue(true)
    vw.orgId = null
    // A fully live Twilio voice rail: subaccount credentials + voice API key +
    // TwiML app + a number.
    h.loadRoutingStateMock.mockReset().mockResolvedValue({
      voice_provider: "twilio",
      phone_number: "+18885551234",
      subaccount_sid: "ACsub",
      api_key_sid: "SK1",
      twiml_app_sid: "AP1",
      has_credentials: true,
    })
    h.clientForOrg.mockReset().mockResolvedValue({ calls: { create: h.createMock } })
    h.createMock.mockReset().mockResolvedValue({ sid: "CA-prospect" })
    h.inserted = []
    h.updates = []
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.io"
    process.env.TELNYX_PINNED_ORG_IDS = ""
  })

  test("bad signature → 403, no insert, no dial-out", async () => {
    h.validateMock.mockReturnValue(false)
    const res = await POST(req({ From: `client:${IDENTITY}`, To: "+12223334444", CallSid: "CA1" }))
    expect(res.status).toBe(403)
    expect(h.inserted.length).toBe(0)
    expect(h.createMock).not.toHaveBeenCalled()
  })

  test("valid → agent joins a <Conference> room; prospect dialed into the same room; far_leg captured", async () => {
    const res = await POST(req({ From: `client:${IDENTITY}`, To: "+12223334444", CallSid: "CA1" }))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("text/xml")
    const xml = await res.text()

    // Agent TwiML: joins the conference, recorded from start, conference-events callback.
    expect(xml).toContain("<Conference")
    expect(xml).toContain(`>${ROOM}</Conference>`)
    expect(xml).toContain('record="record-from-start"')
    expect(xml).toContain("/api/webhooks/twilio-conference-events?ref=CA1")
    expect(xml).toContain("/api/webhooks/twilio-recording?ref=CA1")

    // Ringback (not hold music) while the prospect leg dials in: waitUrl points at
    // the ringback route.
    expect(xml).toContain("waitUrl=")
    expect(xml).toContain("/api/webhooks/twilio-voice-ringback")

    // Prospect dialed into the SAME room via calls.create, ref'd status callback.
    expect(h.createMock).toHaveBeenCalledTimes(1)
    expect(h.clientForOrg).toHaveBeenCalledWith(ORG)
    const arg = h.createMock.mock.calls[0][0]
    expect(arg.to).toBe("+12223334444")
    expect(arg.from).toBe("+18885551234")
    expect(arg.statusCallback).toBe("https://app.listhit.io/api/webhooks/twilio-voice-status?ref=CA1")
    expect(arg.twiml).toContain(ROOM)
    expect(arg.twiml).toContain("<Conference")

    // Row inserted with the room name; far leg captured from the created leg.
    expect(h.inserted[0]).toEqual(
      expect.objectContaining({
        call_sid: "CA1",
        org_id: ORG,
        direction: "outbound",
        status: "initiated",
        provider: "twilio",
        conference_name: ROOM,
      }),
    )
    // started_at is stamped so the row survives the Calls page "Today" filter.
    expect(typeof h.inserted[0].started_at).toBe("string")
    expect(Number.isNaN(Date.parse(h.inserted[0].started_at))).toBe(false)
    expect(h.updates).toContainEqual({ far_leg_sid: "CA-prospect" })
  })

  test("subaccount-signed request for its own org → dials with that org's client", async () => {
    vw.orgId = ORG
    const res = await POST(req({ From: `client:${IDENTITY}`, To: "+12223334444", CallSid: "CA1" }))
    expect(res.status).toBe(200)
    expect(await res.text()).toContain("<Conference")
    expect(h.clientForOrg).toHaveBeenCalledWith(ORG)
  })

  test("verified subaccount org ≠ the identity's org → 403, no insert, no dial-out", async () => {
    vw.orgId = "33333333-3333-3333-3333-333333333333"
    const res = await POST(req({ From: `client:${IDENTITY}`, To: "+12223334444", CallSid: "CA1" }))
    expect(res.status).toBe(403)
    expect(h.inserted.length).toBe(0)
    expect(h.createMock).not.toHaveBeenCalled()
    expect(h.clientForOrg).not.toHaveBeenCalled()
  })

  test("tenant whose voice isn't live (no TwiML app) → blocked → hangup, no insert, no dial-out", async () => {
    h.loadRoutingStateMock.mockResolvedValue({
      voice_provider: "twilio",
      phone_number: "+18885551234",
      subaccount_sid: "ACsub",
      api_key_sid: "SK1",
      twiml_app_sid: null,
      has_credentials: true,
    })
    const res = await POST(req({ From: `client:${IDENTITY}`, To: "+12223334444", CallSid: "CA1" }))
    expect(res.status).toBe(200)
    expect(await res.text()).toContain("<Hangup/>")
    expect(h.inserted.length).toBe(0)
    expect(h.createMock).not.toHaveBeenCalled()
  })

  test("pinned org → hangup, no insert, no dial-out", async () => {
    process.env.TELNYX_PINNED_ORG_IDS = ORG
    const res = await POST(req({ From: `client:${IDENTITY}`, To: "+12223334444", CallSid: "CA1" }))
    expect(res.status).toBe(200)
    const xml = await res.text()
    expect(xml).toContain("<Hangup/>")
    expect(xml).not.toContain("<Conference")
    expect(h.inserted.length).toBe(0)
    expect(h.createMock).not.toHaveBeenCalled()
  })

  test("unparseable identity → hangup, no insert, no dial-out", async () => {
    const res = await POST(req({ From: "client:garbage", To: "+12223334444", CallSid: "CA1" }))
    expect(res.status).toBe(200)
    const xml = await res.text()
    expect(xml).toContain("<Hangup/>")
    expect(h.inserted.length).toBe(0)
    expect(h.createMock).not.toHaveBeenCalled()
    expect(h.loadRoutingStateMock).not.toHaveBeenCalled()
  })

  test("invalid destination → hangup, no insert, no dial-out", async () => {
    const res = await POST(req({ From: `client:${IDENTITY}`, To: "not-a-number", CallSid: "CA1" }))
    expect(res.status).toBe(200)
    const xml = await res.text()
    expect(xml).toContain("<Hangup/>")
    expect(h.inserted.length).toBe(0)
    expect(h.createMock).not.toHaveBeenCalled()
  })

  test("prospect dial-in throwing → hangup (row inserted, no far-leg captured)", async () => {
    h.createMock.mockRejectedValue(new Error("twilio down"))
    const res = await POST(req({ From: `client:${IDENTITY}`, To: "+12223334444", CallSid: "CA1" }))
    expect(res.status).toBe(200)
    const xml = await res.text()
    expect(xml).toContain("<Hangup/>")
    expect(xml).not.toContain("<Conference")
    expect(h.createMock).toHaveBeenCalledTimes(1)
    expect(h.inserted.length).toBe(1)
    expect(h.updates).not.toContainEqual({ far_leg_sid: "CA-prospect" })
  })
})
