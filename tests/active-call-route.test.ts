import { describe, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { GET } from "../app/api/agents/active-call/route"

jest.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      name === "agent_session" ? { value: "agent123:token" } : undefined,
  }),
}))

jest.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: { message: "no call" } }),
        }),
      }),
    }),
  },
}))

describe("active-call route", () => {
  test("returns null when no active call", async () => {
    const req = new NextRequest("http://test", { method: "GET" })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ active_call: null })
  })
})
