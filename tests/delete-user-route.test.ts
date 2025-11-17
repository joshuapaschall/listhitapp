import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/delete-user/route"
jest.mock("next/headers", () => ({
  cookies: () => ({ get: jest.fn(), set: jest.fn(), delete: jest.fn() }),
}))

let deleted: string[] = []

jest.mock("../lib/supabase", () => {
  const client = {
    auth: { admin: { deleteUser: jest.fn(async (id: string) => { deleted.push(id); return { error: null } }) } },
    from: () => ({ delete: () => ({ eq: async () => ({ error: null }) }) }),
  }
  return { supabaseAdmin: client }
})

jest.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "a" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" }, error: null }) }) }) }),
  }),
}))

describe("delete-user route", () => {
  beforeEach(() => { deleted = [] })
  test("deletes", async () => {
    const req = new NextRequest("http://t", { method: "POST", body: JSON.stringify({ userId: "u1" }) })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(deleted).toContain("u1")
  })
})
