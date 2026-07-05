import { NextRequest } from "next/server"

const h = vi.hoisted(() => {
  const state = {
    row: null as any,
    updates: null as any,
    queriedSid: null as any,
    rpcResult: [{ remaining: 0, answered: false }] as any,
    rpcArgs: null as any,
    redirectedSid: null as any,
    redirectTwiml: null as any,
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
    rpc: async (_name: string, args: any) => {
      state.rpcArgs = args
      return { data: state.rpcResult, error: null }
    },
  }
  return { state, client, validateMock: vi.fn(() => true), greetingMock: vi.fn(async () => null as string | null) }
})

vi.mock("twilio", async (importOriginal) => {
  const actual: any = await importOriginal()
  const d = actual.default
  return { ...actual, default: { ...d, validateRequest: h.validateMock } }
})
vi.mock("@/lib/supabase", () => ({ supabase: h.client, supabaseAdmin: h.client }))
vi.mock("@/lib/voice/routing", () => ({ getVoicemailGreetingUrl: h.greetingMock }))
vi.mock("@/lib/providers/twilio/client", () => ({
  getTwilioClient: () => ({
    calls: (sid: string) => {
      h.state.redirectedSid = sid
      return {
        update: async (opts: any) => {
          h.state.redirectTwiml = opts.twiml
          return {}
        },
      }
    },
  }),
}))

const { POST } = await import("../app/api/webhooks/twilio-voice-status/route")

function req(fields: Record<string, string>, ref?: string, role?: string) {
  const qs: string[] = []
  if (ref) qs.push(`ref=${encodeURIComponent(ref)}`)
  if (role) qs.push(`role=${encodeURIComponent(role)}`)
  const url = `http://test/api/webhooks/twilio-voice-status${qs.length ? `?${qs.join("&")}` : ""}`
  return new NextRequest(url, {
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
    h.greetingMock.mockReset().mockResolvedValue(null)
    h.state.row = { id: "c1", answered_at: null }
    h.state.updates = null
    h.state.queriedSid = null
    h.state.rpcResult = [{ remaining: 0, answered: false }]
    h.state.rpcArgs = null
    h.state.redirectedSid = null
    h.state.redirectTwiml = null
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.io"
    process.env.LISTHIT_TWILIO_AUTH_TOKEN = "AUTH"
  })

  // --- outbound prospect legs (C1a), no role — unchanged ---
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

    h.state.row = { id: "c1", answered_at: "2020-01-01T00:00:00Z" }
    await POST(req({ CallSid: "CH1", ParentCallSid: "CA1", CallStatus: "in-progress" }))
    expect(h.state.updates.answered_at).toBe("2020-01-01T00:00:00Z")
  })

  test("completed writes duration_seconds (the UI column) + duration + ended_at", async () => {
    await POST(req({ CallSid: "CH1", ParentCallSid: "CA1", CallStatus: "completed", CallDuration: "137" }))
    expect(h.state.updates.status).toBe("completed")
    expect(h.state.updates.duration_seconds).toBe(137)
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

  test("resolves the row by ?ref= (prospect leg has no ParentCallSid)", async () => {
    await POST(req({ CallSid: "CA-prospect", CallStatus: "completed", CallDuration: "88" }, "CA-agent"))
    expect(h.state.queriedSid).toBe("CA-agent")
    expect(h.state.updates.status).toBe("completed")
    expect(h.state.updates.duration).toBe(88)
  })

  // --- C1b: inbound agent legs (role=agent) ---
  test("agent in-progress → agent_answered true, answered_at set, no duration", async () => {
    await POST(req({ CallSid: "CA-agent-leg", CallStatus: "in-progress" }, "CA-caller", "agent"))
    expect(h.state.updates.agent_answered).toBe(true)
    expect(h.state.updates.status).toBe("in-progress")
    expect(typeof h.state.updates.answered_at).toBe("string")
    expect(h.state.updates.duration).toBeUndefined()
  })

  test("last agent leg ends unanswered → redirects the caller to voicemail", async () => {
    h.state.rpcResult = [{ remaining: 0, answered: false }]
    h.state.row = { to_number: "+18885551234", status: "ringing" }
    const res = await POST(req({ CallSid: "CA-agent-leg", CallStatus: "no-answer" }, "CA-caller", "agent"))
    expect(res.status).toBe(204)
    expect(h.state.rpcArgs).toEqual({ p_call_sid: "CA-caller" })
    expect(h.state.redirectedSid).toBe("CA-caller")
    expect(h.state.redirectTwiml).toContain("<Record")
  })

  test("agent leg ends but others still outstanding → no redirect", async () => {
    h.state.rpcResult = [{ remaining: 1, answered: false }]
    await POST(req({ CallSid: "CA-agent-leg", CallStatus: "no-answer" }, "CA-caller", "agent"))
    expect(h.state.redirectedSid).toBeNull()
  })

  test("last agent leg ends but someone answered → no redirect", async () => {
    h.state.rpcResult = [{ remaining: 0, answered: true }]
    await POST(req({ CallSid: "CA-agent-leg", CallStatus: "completed" }, "CA-caller", "agent"))
    expect(h.state.redirectedSid).toBeNull()
  })

  test("no redirect when the caller row is already a voicemail", async () => {
    h.state.rpcResult = [{ remaining: 0, answered: false }]
    h.state.row = { to_number: "+18885551234", status: "voicemail" }
    await POST(req({ CallSid: "CA-agent-leg", CallStatus: "failed" }, "CA-caller", "agent"))
    expect(h.state.redirectedSid).toBeNull()
  })

  test("agent ringing → 204, no-op (no update, no rpc)", async () => {
    const res = await POST(req({ CallSid: "CA-agent-leg", CallStatus: "ringing" }, "CA-caller", "agent"))
    expect(res.status).toBe(204)
    expect(h.state.updates).toBeNull()
    expect(h.state.rpcArgs).toBeNull()
  })
})
