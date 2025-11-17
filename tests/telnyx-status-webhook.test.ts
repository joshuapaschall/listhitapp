import { describe, beforeEach, test, expect } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/webhooks/telnyx-status/route"
jest.mock("../lib/telnyx", () => ({ verifyTelnyxRequest: () => true }))

let recipients: any[] = []

jest.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table !== "campaign_recipients") throw new Error(`Unexpected table ${table}`)
      return {
        update: (data: any) => ({
          eq: (_col: string, sid: string) => {
            const row = recipients.find(r => r.provider_id === sid)
            if (row) Object.assign(row, data)
            return {
              select: () => ({ data: null, error: null, count: row ? 1 : 0 })
            }
          },
        }),
      }
    },
  }
  return { supabase: client, supabaseAdmin: client }
})

describe("Telnyx status webhook", () => {
  beforeEach(() => {
    recipients = [
      { id: "r1", provider_id: "m1", status: "sent", error: null },
    ]
  })

  test("updates status and error", async () => {
    const body = {
      data: {
        event_type: "message.finalized",
        payload: { id: "m1", status: "failed", errors: [{ detail: "oops" }] },
      },
    }
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify(body),
    })

    await POST(req)

    expect(recipients[0].status).toBe("failed")
    expect(recipients[0].error).toBe("oops")
  })
})
