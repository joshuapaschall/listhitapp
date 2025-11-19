import { describe, beforeEach, test, expect, jest } from "@jest/globals"

const inboundRowsRef = { value: [] as { e164: string }[] }
const voiceRowsRef = { value: [] as { phone_number: string }[] }
const inboundErrorRef = { value: null as any }
const voiceErrorRef = { value: null as any }

const mockClient = {
  from: (table: string) => {
    if (table === "inbound_numbers") {
      return {
        select: () => ({
          eq: async () => ({
            data: inboundErrorRef.value ? null : inboundRowsRef.value,
            error: inboundErrorRef.value,
          }),
        }),
      }
    }
    if (table === "voice_numbers") {
      return {
        select: async () => ({
          data: voiceErrorRef.value ? null : voiceRowsRef.value,
          error: voiceErrorRef.value,
        }),
      }
    }
    throw new Error(`Unexpected table ${table}`)
  },
}

jest.unstable_mockModule("@/lib/supabase", () => ({
  supabase: mockClient,
  supabaseAdmin: mockClient,
}))

const mod = await import("../app/api/voice-numbers/route")
const { GET } = mod

describe("voice numbers route", () => {
  beforeEach(() => {
    inboundRowsRef.value = [
      { e164: "+1555" },
      { e164: "+1666" },
    ]
    voiceRowsRef.value = [{ phone_number: "+1777" }]
    inboundErrorRef.value = null
    voiceErrorRef.value = null
  })

  test("returns inbound numbers when available", async () => {
    const res = await GET()
    const data = await res.json()
    expect(data).toEqual({ numbers: ["+1555", "+1666"] })
  })

  test("falls back to legacy voice numbers", async () => {
    inboundRowsRef.value = []
    const res = await GET()
    const data = await res.json()
    expect(data).toEqual({ numbers: ["+1777"] })
  })

  test("returns error when both queries fail", async () => {
    inboundErrorRef.value = new Error("fail")
    voiceErrorRef.value = new Error("fail")
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
