import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { GET } from "../app/api/voice-numbers/route"

let rows: string[] = []
let dbError: any = null

jest.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table !== "voice_numbers") {
        throw new Error(`Unexpected table ${table}`)
      }
      return {
        select: async () => ({
          data: dbError ? null : rows.map(n => ({ phone_number: n })),
          error: dbError,
        }),
      }
    },
  }
  return { supabase: client, supabaseAdmin: client }
})

describe("voice numbers route", () => {
  beforeEach(() => {
    rows = ["+1555", "+1666"]
    dbError = null
  })

  test("returns numbers", async () => {
    const res = await GET()
    const data = await res.json()
    expect(data).toEqual({ numbers: ["+1555", "+1666"] })
  })

  test("handles db error", async () => {
    dbError = new Error("fail")
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
