import { describe, beforeEach, afterEach, test, expect } from "@jest/globals"
import { NextRequest } from "next/server"
import { GET } from "../app/api/export-conversation/[buyerId]/route"

let messages: any[] = []
let supabase: any

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => supabase,
}))

function buildSupabase() {
  return {
    from: (table: string) => {
      if (table !== "messages") throw new Error(`Unexpected table ${table}`)
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              order: async () => ({ data: messages, error: null }),
            }),
          }),
        }),
      }
    },
  }
}

describe("export conversation route", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "key"
    messages = [
      { id: "m1", buyer_id: "b1", created_at: "2025", direction: "outbound" },
    ]
    supabase = buildSupabase()
  })

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  test("returns csv", async () => {
    const req = new NextRequest("http://test?format=csv")
    const res = await GET(req, { params: { buyerId: "b1" } })
    const text = await res.text()
    expect(text).toContain("outbound")
    expect(res.headers.get("Content-Type")).toBe("text/csv")
  })

  test("returns json by default", async () => {
    const req = new NextRequest("http://test")
    const res = await GET(req, { params: { buyerId: "b1" } })
    const text = await res.text()
    expect(text).toContain("outbound")
    expect(res.headers.get("Content-Type")).toBe("application/json")
  })

  test("throws if service role key missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const req = new NextRequest("http://test")
    await expect(
      GET(req, { params: { buyerId: "b1" } })
    ).rejects.toThrow("SUPABASE_SERVICE_ROLE_KEY is required")
  })
})
