import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/calls/record/route"

let insertedCalls: any[] = []
let senderMappings: any[] = []
let callId = 1

jest.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "calls") {
        return {
          insert: (row: any) => ({
            select: () => ({
              single: async () => {
                const record = { id: `call-${callId++}`, ...row }
                insertedCalls.push(record)
                return { data: record, error: null }
              }
            })
          })
        }
      }

      if (table === "buyer_sms_senders") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => {
                const existing = senderMappings.find(entry => entry.buyer_id === value)
                return { data: existing || null, error: null }
              }
            })
          }),
          insert: async (row: any) => {
            senderMappings.push(row)
            return { data: row, error: null }
          }
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }
  }

  return { supabase: client, supabaseAdmin: client }
})

describe("/api/calls/record", () => {
  beforeEach(() => {
    insertedCalls = []
    senderMappings = []
    callId = 1
  })

  test("stores WebRTC flag when creating call records", async () => {
    const request = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({
        buyerId: "buyer-1",
        to: "+12223334444",
        callerId: "+19998887777",
        webrtc: true
      })
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(insertedCalls).toHaveLength(1)
    expect(insertedCalls[0]).toEqual(
      expect.objectContaining({
        buyer_id: "buyer-1",
        to_number: "+12223334444",
        from_number: "+19998887777",
        webrtc: true
      })
    )
    expect(senderMappings).toEqual([
      { buyer_id: "buyer-1", from_number: "+19998887777" }
    ])
  })
})
