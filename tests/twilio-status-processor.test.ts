const h = vi.hoisted(() => {
  const state = {
    row: null as any,
    updates: null as any,
    updatedId: null as any,
  }
  const client = {
    from: (_table: string) => ({
      select: () => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: async () => ({ data: state.row, error: null }),
        }),
      }),
      update: (updates: any) => {
        state.updates = updates
        return {
          eq: (_col: string, val: any) => {
            state.updatedId = val
            return Promise.resolve({ error: null })
          },
        }
      },
    }),
  }
  return { state, client }
})

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.client, supabase: h.client }))

// Twilio client used only for the delivered cost/segment backfill. Default rejects
// (simulating "not priced yet") so existing delivered cases stay deterministic;
// backfill tests override per-call.
const tw = vi.hoisted(() => ({
  fetchMsgMock: vi.fn(async () => {
    throw new Error("not priced yet")
  }),
}))
vi.mock("@/lib/providers/twilio/client", () => ({
  getTwilioClient: () => ({ messages: () => ({ fetch: tw.fetchMsgMock }) }),
}))

import { processTwilioStatusEvent } from "@/lib/twilio-status-processor"

describe("processTwilioStatusEvent", () => {
  beforeEach(() => {
    h.state.row = { id: "r1", buyer_id: "b1", delivered_at: null, rejected_at: null }
    h.state.updates = null
    h.state.updatedId = null
  })

  test("delivered → sets delivered_at on the row matched by provider_id", async () => {
    const res = await processTwilioStatusEvent({ messageSid: "SM1", messageStatus: "delivered" })
    expect(res.status).toBe(204)
    expect(h.state.updatedId).toBe("r1")
    expect(h.state.updates.status).toBe("delivered")
    expect(typeof h.state.updates.delivered_at).toBe("string")
    expect(h.state.updates.rejected_at).toBeUndefined()
  })

  test("failed → sets rejected_at and error", async () => {
    const res = await processTwilioStatusEvent({ messageSid: "SM1", messageStatus: "failed", errorCode: "30006" })
    expect(res.status).toBe(204)
    expect(typeof h.state.updates.rejected_at).toBe("string")
    expect(h.state.updates.error).toContain("30006")
  })

  test("undelivered without an error code → rejected_at + status as error detail", async () => {
    const res = await processTwilioStatusEvent({ messageSid: "SM1", messageStatus: "undelivered" })
    expect(res.status).toBe(204)
    expect(typeof h.state.updates.rejected_at).toBe("string")
    expect(h.state.updates.error).toBe("undelivered")
  })

  test("does not overwrite an existing delivered_at", async () => {
    h.state.row = { id: "r1", buyer_id: "b1", delivered_at: "2026-01-01T00:00:00Z", rejected_at: null }
    await processTwilioStatusEvent({ messageSid: "SM1", messageStatus: "delivered" })
    expect(h.state.updates.delivered_at).toBeUndefined()
  })

  test("intermediate status (sent) → status only, no terminal timestamps", async () => {
    await processTwilioStatusEvent({ messageSid: "SM1", messageStatus: "sent" })
    expect(h.state.updates.status).toBe("sent")
    expect(h.state.updates.delivered_at).toBeUndefined()
    expect(h.state.updates.rejected_at).toBeUndefined()
    expect(h.state.updates.error).toBeUndefined()
  })

  test("unknown MessageSid → 204 and no update", async () => {
    h.state.row = null
    const res = await processTwilioStatusEvent({ messageSid: "nope", messageStatus: "delivered" })
    expect(res.status).toBe(204)
    expect(h.state.updates).toBeNull()
  })

  test("missing params → 400", async () => {
    const res = await processTwilioStatusEvent({ messageSid: "", messageStatus: "delivered" })
    expect(res.status).toBe(400)
  })

  test("delivered backfills actual_segments/actual_cost_usd from the message resource", async () => {
    tw.fetchMsgMock.mockResolvedValueOnce({ numSegments: "2", price: "-0.01500", priceUnit: "USD" })
    const res = await processTwilioStatusEvent({ messageSid: "SM1", messageStatus: "delivered" })
    expect(res.status).toBe(204)
    expect(tw.fetchMsgMock).toHaveBeenCalled()
    expect(h.state.updates.actual_segments).toBe(2)
    expect(h.state.updates.actual_cost_usd).toBeCloseTo(0.015)
  })

  test("delivered with a fetch error still writes the status update (204)", async () => {
    tw.fetchMsgMock.mockRejectedValueOnce(new Error("boom"))
    const res = await processTwilioStatusEvent({ messageSid: "SM1", messageStatus: "delivered" })
    expect(res.status).toBe(204)
    expect(h.state.updates.status).toBe("delivered")
    expect(h.state.updates.actual_cost_usd).toBeUndefined()
    expect(h.state.updates.actual_segments).toBeUndefined()
  })

  test("does not backfill when actual_cost_usd already present", async () => {
    h.state.row = { id: "r1", buyer_id: "b1", delivered_at: null, rejected_at: null, actual_cost_usd: 0.02 }
    tw.fetchMsgMock.mockClear()
    await processTwilioStatusEvent({ messageSid: "SM1", messageStatus: "delivered" })
    expect(tw.fetchMsgMock).not.toHaveBeenCalled()
  })

  test("non-delivered status does not fetch the message resource", async () => {
    tw.fetchMsgMock.mockClear()
    await processTwilioStatusEvent({ messageSid: "SM1", messageStatus: "sent" })
    expect(tw.fetchMsgMock).not.toHaveBeenCalled()
  })
})
