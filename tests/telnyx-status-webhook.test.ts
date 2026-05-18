import { NextRequest } from "next/server"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { POST } from "../app/api/webhooks/telnyx-status/route"

vi.mock("../lib/telnyx", () => ({ verifyTelnyxRequest: () => true }))

let recipients: any[] = []

vi.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table !== "campaign_recipients") throw new Error(`Unexpected table ${table}`)
      return {
        select: (_cols: string) => ({
          eq: (_col: string, providerId: string) => ({
            maybeSingle: async () => ({
              data: recipients.find((r) => r.provider_id === providerId) ?? null,
              error: null,
            }),
          }),
        }),
        update: (data: Record<string, any>) => ({
          eq: async (_col: string, id: string) => {
            const row = recipients.find((r) => r.id === id)
            if (row) Object.assign(row, data)
            return { error: null }
          },
        }),
      }
    },
  }
  return { supabase: client }
})

describe("Telnyx status webhook", () => {
  beforeEach(() => {
    recipients = [
      {
        id: "r1",
        provider_id: "m1",
        delivered_at: null,
        rejected_at: null,
        delivery_delayed_at: null,
        actual_cost_usd: null,
      },
    ]
  })

  async function send(payload: any, eventType = "message.delivered") {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ data: { event_type: eventType, payload } }),
    })
    return POST(req)
  }

  test("sets delivered_at on delivered", async () => {
    await send({ id: "m1", status: "delivered" })
    expect(recipients[0].status).toBe("delivered")
    expect(recipients[0].delivered_at).toBeTruthy()
  })

  test("sets rejected_at and error on delivery_failed", async () => {
    await send({ id: "m1", status: "delivery_failed", errors: [{ detail: "carrier reject" }] })
    expect(recipients[0].rejected_at).toBeTruthy()
    expect(recipients[0].error).toBe("carrier reject")
  })

  test("captures finalized metrics", async () => {
    await send(
      {
        id: "m1",
        to: [{ status: "delivered", carrier: "Verizon" }],
        cost: { amount: "0.018" },
        parts: 2,
      },
      "message.finalized"
    )
    expect(recipients[0].actual_cost_usd).toBe(0.018)
    expect(recipients[0].actual_segments).toBe(2)
    expect(recipients[0].recipient_carrier).toBe("Verizon")
  })

  test("does not overwrite delivered_at on duplicate delivered", async () => {
    recipients[0].delivered_at = "2025-01-01T00:00:00.000Z"
    await send({ id: "m1", status: "delivered" })
    expect(recipients[0].delivered_at).toBe("2025-01-01T00:00:00.000Z")
  })
})
