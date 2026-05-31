import { NextRequest } from "next/server"

let upserts: any[] = []
let fetchMock: any
let supabase: any

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => supabase,
}))

describe("sync voice numbers route", () => {
  beforeEach(() => {
    upserts = []
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: [], meta: {} }) }))
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
    process.env.TELNYX_MESSAGING_PROFILE_ID = "mp1"
  })

  test("GET triggers a sync (aliases POST) and requires auth", async () => {
    const { GET } = await import("../app/api/sync/voice-numbers/route")
    const req = new NextRequest("http://test", { method: "GET" })
    const res = await GET(req)
    // GET is wired to POST; without valid auth it must be rejected.
    expect(res.status).toBe(401)
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
