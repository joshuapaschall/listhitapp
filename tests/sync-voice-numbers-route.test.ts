import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"

let upserts: any[] = []
let fetchMock: any
let supabase: any

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => supabase,
}))

describe("sync voice numbers route", () => {
  beforeEach(() => {
    upserts = []
    fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ data: [], meta: {} }) }))
    // @ts-ignore
    global.fetch = fetchMock
    supabase = {
      from: (table: string) => {
        if (table !== "voice_numbers") throw new Error(`Unexpected table ${table}`)
        return {
          upsert: async (row: any) => {
            upserts.push(row)
            return { data: null, error: null }
          },
        }
      },
    }
    process.env.VOICE_SYNC_SECRET_KEY = "tok"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://local"
    process.env.TELNYX_API_KEY = "key"
  })

  test("GET returns 405", async () => {
    const { GET } = await import("../app/api/sync/voice-numbers/route")
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(405)
    expect(body.message).toMatch(/POST/)
  })

  test("rejects missing auth", async () => {
    const { POST } = await import("../app/api/sync/voice-numbers/route")
    const req = new NextRequest("http://test", { method: "POST" })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  test("syncs numbers", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ phone_number: "+1555" }], meta: {} }) })
    const { POST } = await import("../app/api/sync/voice-numbers/route")
    const req = new NextRequest("http://test", {
      method: "POST",
      headers: { Authorization: "Bearer tok" },
    })
    const res = await POST(req)
    const data = await res.json()
    expect(fetchMock).toHaveBeenCalled()
    expect(upserts.length).toBe(1)
    expect(data).toEqual({ status: "success", synced: 1 })
  })
})
