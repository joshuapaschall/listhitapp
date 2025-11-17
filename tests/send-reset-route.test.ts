import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/send-reset/route"
jest.mock("next/headers", () => ({
  cookies: () => ({ get: jest.fn(), set: jest.fn(), delete: jest.fn() }),
}))

let resets: string[] = []

jest.mock("../lib/supabase", () => {
  const client = {
    auth: { admin: { resetPasswordForEmail: jest.fn(async (email: string) => { resets.push(email); return { error: null } }) } },
  }
  return { supabaseAdmin: client }
})

jest.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "a" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" }, error: null }) }) }) }),
  }),
}))

describe("send-reset route", () => {
  beforeEach(() => { resets = [] })
  test("sends", async () => {
    const req = new NextRequest("http://t", { method: "POST", body: JSON.stringify({ email: "a@test.com" }) })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(resets).toContain("a@test.com")
  })
})
