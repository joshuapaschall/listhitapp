import { NextRequest } from "next/server"
import { buildVoiceIdentity } from "@/lib/providers/voice/identity"

// Keep the real twilio.twiml.VoiceResponse (so we assert real TwiML) but stub
// validateRequest.
const h = vi.hoisted(() => ({
  validateMock: vi.fn(() => true),
  getOrgTwilioMock: vi.fn(),
  createMock: vi.fn(),
  inserted: [] as any[],
  updates: [] as any[],
}))

vi.mock("twilio", async (importOriginal) => {
  const actual: any = await importOriginal()
  const d = actual.default
  return { ...actual, default: { ...d, validateRequest: h.validateMock } }
})
vi.mock("@/lib/org-twilio/service", () => ({ getOrgTwilio: h.getOrgTwilioMock }))
vi.mock("@/lib/providers/twilio/client", () => ({
  getTwilioClient: () => ({ calls: { create: h.createMock } }),
}))
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
    h.getOrgTwilioMock.mockReset().mockResolvedValue({
      voice_provider: "twilio",
      phone_number: "+18885551234",
    })
    h.createMock.mockReset().mockResolvedValue({ sid: "CA-prospect" })
    h.inserted = []
    h.updates = []
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.io"
    process.env.LISTHIT_TWILIO_AUTH_TOKEN = "AUTH"
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

    // Prospect dialed into the SAME room via calls.create, ref'd status callback.
    expect(h.createMock).toHaveBeenCalledTimes(1)
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
    expect(h.updates).toContainEqual({ far_leg_sid: "CA-prospect" })
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
    expect(h.getOrgTwilioMock).not.toHaveBeenCalled()
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
