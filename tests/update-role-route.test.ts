import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/update-role/route"

let profiles: any[] = []

jest.mock("../lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`Unexpected table ${table}`)
      return {
        update: (_val: any) => ({
          eq: async (_c: string, id: string) => {
            const idx = profiles.findIndex((p) => p.id === id)
            if (idx !== -1) profiles[idx] = { ...profiles[idx], ..._val }
            return { data: null, error: null }
          },
        }),
      }
    },
  }
  return { supabaseAdmin: client }
})

describe("update-role route", () => {
  beforeEach(() => {
    profiles = [{ id: "u1", role: "user" }]
    process.env.SUPABASE_SERVICE_ROLE_KEY = "key"
  })

  test("rejects missing header", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ userId: "u1", role: "admin" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  test("updates role", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      headers: { SUPABASE_SERVICE_ROLE_KEY: "key" },
      body: JSON.stringify({ userId: "u1", role: "admin" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(profiles[0].role).toBe("admin")
  })
})
