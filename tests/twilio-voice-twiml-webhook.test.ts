import { NextRequest } from "next/server"
import { buildVoiceIdentity } from "@/lib/providers/voice/identity"

// Keep the real twilio.twiml.VoiceResponse (so we assert real TwiML) but stub
// validateRequest.
const h = vi.hoisted(() => ({
  validateMock: vi.fn(() => true),
  getOrgTwilioMock: vi.fn(),
  inserted: [] as any[],
}))

vi.mock("twilio", async (importOriginal) => {
  const actual: any = await importOriginal()
  const d = actual.default
  return { ...actual, default: { ...d, validateRequest: h.validateMock } }
})
vi.mock("@/lib/org-twilio/service", () => ({ getOrgTwilio: h.getOrgTwilioMock }))
vi.mock("@/lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "calls") {
        return {
          insert: async (row: any) => {
            h.inserted.push(row)
            return { error: null }
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

describe("twilio voice TwiML webhook", () => {
  beforeEach(() => {
    h.validateMock.mockReset().mockReturnValue(true)
    h.getOrgTwilioMock.mockReset().mockResolvedValue({
      voice_provider: "twilio",
      phone_number: "+18885551234",
    })
    h.inserted = []
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.io"
    process.env.LISTHIT_TWILIO_AUTH_TOKEN = "AUTH"
    process.env.TELNYX_PINNED_ORG_IDS = ""
  })

  test("bad signature → 403, no insert", async () => {
    h.validateMock.mockReturnValue(false)
    const res = await POST(req({ From: `client:${IDENTITY}`, To: "+12223334444", CallSid: "CA1" }))
    expect(res.status).toBe(403)
    expect(h.inserted.length).toBe(0)
  })

  test("valid + twilio-routed org → <Dial> TwiML and a calls insert", async () => {
    const res = await POST(req({ From: `client:${IDENTITY}`, To: "+12223334444", CallSid: "CA1" }))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("text/xml")
    const xml = await res.text()
    // <Dial> now carries recording attrs too, so assert the tag + callerId separately
    // (the exact "<Dial callerId=…>" closing bracket no longer follows callerId).
    expect(xml).toContain("<Dial")
    expect(xml).toContain('callerId="+18885551234"')
    expect(xml).toContain("+12223334444")
    expect(xml).toContain("https://app.listhit.io/api/webhooks/twilio-voice-status")

    expect(h.inserted.length).toBe(1)
    expect(h.inserted[0]).toEqual(
      expect.objectContaining({
        call_sid: "CA1",
        org_id: ORG,
        direction: "outbound",
        from_number: "+18885551234",
        to_number: "+12223334444",
        status: "initiated",
        provider: "twilio",
      }),
    )
  })

  test("outbound <Dial> auto-records the conversation (dual channel)", async () => {
    const res = await POST(req({ From: `client:${IDENTITY}`, To: "+12223334444", CallSid: "CA1" }))
    const xml = await res.text()
    expect(xml).toContain('record="record-from-answer-dual"')
    expect(xml).toContain("/api/webhooks/twilio-recording")
  })

  test("pinned org → hangup TwiML, no <Dial>, no insert", async () => {
    process.env.TELNYX_PINNED_ORG_IDS = ORG
    const res = await POST(req({ From: `client:${IDENTITY}`, To: "+12223334444", CallSid: "CA1" }))
    expect(res.status).toBe(200)
    const xml = await res.text()
    expect(xml).toContain("<Hangup/>")
    expect(xml).not.toContain("<Dial")
    expect(h.inserted.length).toBe(0)
  })

  test("unparseable identity → hangup TwiML, no insert", async () => {
    const res = await POST(req({ From: "client:garbage", To: "+12223334444", CallSid: "CA1" }))
    expect(res.status).toBe(200)
    const xml = await res.text()
    expect(xml).toContain("<Hangup/>")
    expect(h.inserted.length).toBe(0)
    expect(h.getOrgTwilioMock).not.toHaveBeenCalled()
  })

  test("invalid destination → hangup TwiML, no insert", async () => {
    const res = await POST(req({ From: `client:${IDENTITY}`, To: "not-a-number", CallSid: "CA1" }))
    expect(res.status).toBe(200)
    const xml = await res.text()
    expect(xml).toContain("<Hangup/>")
    expect(h.inserted.length).toBe(0)
  })
})
