import { NextRequest } from "next/server"
import { POST } from "../app/api/calls/record/route"

let insertedCalls: any[] = []
let senderMappings: any[] = []
let callId = 1
// Maps a DID (phone_number) to its org. The route looks this up to derive org_id.
let voiceNumberOrgByPhone: Record<string, string> = {}
let voiceNumberLookups: string[][] = []

vi.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "voice_numbers") {
        let candidates: string[] = []
        const query: any = {
          select: () => query,
          in: (_column: string, values: string[]) => {
            candidates = values
            voiceNumberLookups.push(values)
            return query
          },
          not: () => query,
          limit: () => query,
          maybeSingle: async () => {
            const match = candidates.find((phone) => voiceNumberOrgByPhone[phone])
            return { data: match ? { org_id: voiceNumberOrgByPhone[match] } : null, error: null }
          },
        }
        return query
      }

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
    voiceNumberOrgByPhone = {}
    voiceNumberLookups = []
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
      { buyer_id: "buyer-1", from_number: "+19998887777", org_id: null }
    ])
  })

  test("derives org_id from the DID and stamps it on the call + sender records", async () => {
    voiceNumberOrgByPhone = { "+19998887777": "org-42" }

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
    expect(response.status).toBe(200)

    // The route looked up the DID candidates in voice_numbers.
    expect(voiceNumberLookups[0]).toEqual(
      expect.arrayContaining(["+19998887777", "+12223334444"])
    )
    expect(insertedCalls).toHaveLength(1)
    expect(insertedCalls[0].org_id).toBe("org-42")
    expect(senderMappings).toEqual([
      { buyer_id: "buyer-1", from_number: "+19998887777", org_id: "org-42" }
    ])
  })

  test("does not fail the webhook when the DID cannot be resolved to an org", async () => {
    voiceNumberOrgByPhone = {}

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
    expect(response.status).toBe(200)
    expect(insertedCalls[0].org_id).toBeNull()
  })
})
