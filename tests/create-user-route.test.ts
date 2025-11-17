import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/admin/create-user/route"
jest.mock("next/headers", () => ({
  cookies: () => ({ get: jest.fn(), set: jest.fn(), delete: jest.fn() }),
}))

let users: any[] = []
let profiles: any[] = []

jest.mock("../lib/supabase", () => {
  const client = {
    auth: {
      admin: {
        createUser: jest.fn(async ({ email }) => {
          if (users.find((u) => u.email === email)) {
            return { data: null, error: { message: "exists" } }
          }
          const user = { id: `u${users.length + 1}`, email }
          users.push(user)
          return { data: { user }, error: null }
        }),
        deleteUser: jest.fn(),
        resetPasswordForEmail: jest.fn(),
      },
    },
    from: (table: string) => {
      if (table !== "profiles") throw new Error("bad table")
      return {
        insert: async (row: any) => {
          profiles.push(row)
          return { error: null }
        },
      }
    },
  }
  return { supabaseAdmin: client }
})

jest.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "a" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" }, error: null }) }) }) }),
  }),
}))

describe("create-user route", () => {
  beforeEach(() => { users = []; profiles = [] })
  test("creates", async () => {
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify({ email: "t@test.com", password: "pw", role: "user" }) })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(users.length).toBe(1)
    expect(profiles[0]).toEqual({ id: users[0].id, role: "user" })
  })
  test("duplicates", async () => {
    users.push({ id: "u1", email: "t@test.com" })
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify({ email: "t@test.com", password: "pw", role: "user" }) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
