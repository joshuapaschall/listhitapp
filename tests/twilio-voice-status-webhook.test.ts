import { NextRequest } from "next/server"

const h = vi.hoisted(() => {
  const state = {
    row: null as any,
    updates: null as any,
    queriedSid: null as any,
  }
  const client = {
    from: (table: string) => {
      if (table === "calls") {
        return {
          select: () => ({
            eq: (_col: string, val: any) => {
              state.queriedSid = val
              return { maybeSingle: async () => ({ data: state.row, error: null }) }
            },
          }),
          update: (u: any) => {
            state.updates = u
            return { eq: async () => ({ error: null }) }
          },
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { state, client, validateMock: vi.fn(() => true) }
})

vi.mock("twilio", async (importOriginal) => {
  const actual: any = await importOriginal()
  const d = actual.default
  return { ...actual, default: { ...d, validateRequest: h.validateMock } }
})
vi.mock("@/lib/supabase", () => ({ supabase: h.client, supabaseAdmin: h.client }))

const { POST } = await import("../app/api/webhooks/twilio-voice-status/route")

function req(fields: Record<string, string>) {
  return new NextRequest("http://test/api/webhooks/twilio-voice-status", {
    method: "POST",
    body: new URLSearchParams(fields).toString(),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": "sig",
    },
  })
}

describe("twilio voice status webhook", () => {
  beforeEach(() => {
    h.validateMock.mockReset().mockReturnValue(true)
    h.state.row = { id: "c1", answered_at: null }
    h.state.updates = null
    h.state.queriedSid = null
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.io"
    process.env.LISTHIT_TWILIO_AUTH_TOKEN = "AUTH"
  })

  test("bad signature → 403", async () => {
    h.validateMock.mockReturnValue(false)
    const res = await POST(req({ CallSid: "CH1", CallStatus: "completed", CallDuration: "42" }))
    expect(res.status).toBe(403)
    expect(h.state.updates).toBeNull()
  })

  test("matches by ParentCallSid in preference to CallSid", async () => {
    await POST(req({ CallSid: "CH1", ParentCallSid: "CA-parent", CallStatus: "ringing" }))
    expect(h.state.queriedSid).toBe("CA-parent")
    expect(h.state.updates.status).toBe("ringing")
  })

  test("in-progress sets answered_at once", async () => {
    await POST(req({ CallSid: "CH1", ParentCallSid: "CA1", CallStatus: "in-progress" }))
    expect(typeof h.state.updates.answered_at).toBe("string")

    // Already answered → keep the original timestamp.
    h.state.row = { id: "c1", answered_at: "2020-01-01T00:00:00Z" }
    await POST(req({ CallSid: "CH1", ParentCallSid: "CA1", CallStatus: "in-progress" }))
    expect(h.state.updates.answered_at).toBe("2020-01-01T00:00:00Z")
  })

  test("completed writes duration + ended_at", async () => {
    await POST(req({ CallSid: "CH1", ParentCallSid: "CA1", CallStatus: "completed", CallDuration: "137" }))
    expect(h.state.updates.status).toBe("completed")
    expect(h.state.updates.duration).toBe(137)
    expect(typeof h.state.updates.ended_at).toBe("string")
  })

  test("failure statuses set hangup_cause", async () => {
    await POST(req({ CallSid: "CH1", ParentCallSid: "CA1", CallStatus: "no-answer" }))
    expect(h.state.updates.status).toBe("no-answer")
    expect(h.state.updates.hangup_cause).toBe("no-answer")
  })

  test("unknown sid → 204, no update", async () => {
    h.state.row = null
    const res = await POST(req({ CallSid: "CH1", ParentCallSid: "CA-unknown", CallStatus: "completed", CallDuration: "5" }))
    expect(res.status).toBe(204)
    expect(h.state.updates).toBeNull()
  })

  // --- V3d far-leg capture ---
  test("child-leg callback (ParentCallSid) captures far_leg_sid = CallSid", async () => {
    h.state.row = { id: "c1", answered_at: null, far_leg_sid: null }
    await POST(req({ CallSid: "CH-child", ParentCallSid: "CA-parent", CallStatus: "in-progress" }))
    expect(h.state.updates.far_leg_sid).toBe("CH-child")
  })

  test("does NOT overwrite an already-captured far_leg_sid", async () => {
    h.state.row = { id: "c1", answered_at: null, far_leg_sid: "CH-old" }
    await POST(req({ CallSid: "CH-new", ParentCallSid: "CA-parent", CallStatus: "in-progress" }))
    expect(h.state.updates.far_leg_sid).toBeUndefined()
  })

  test("no ParentCallSid → far_leg_sid not set", async () => {
    h.state.row = { id: "c1", answered_at: null, far_leg_sid: null }
    await POST(req({ CallSid: "CH1", CallStatus: "ringing" }))
    expect(h.state.updates.far_leg_sid).toBeUndefined()
  })
})
