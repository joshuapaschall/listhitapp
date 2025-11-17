import { describe, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"

jest.mock("next/headers", () => ({
  cookies: () => ({})
}))

import { POST } from "../app/api/email-metrics/update/route"

const mockUpdate = jest.fn()

jest.mock("../services/email-metrics-service", () => ({
  updateEmailMetrics: (...args: any[]) => mockUpdate(...args)
}))

jest.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => ({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) }
  })
}))

describe("email-metrics update route", () => {
  test("requires userId", async () => {
    const req = new NextRequest("http://test", { method: "POST" })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test("calls updateEmailMetrics and returns counts", async () => {
    mockUpdate.mockResolvedValue({ unsubscribed: 1, bounces: 2, opens: 3 })
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ userId: "u1" })
    })
    const res = await POST(req)
    expect(mockUpdate).toHaveBeenCalledWith("u1")
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ unsubscribed: 1, bounces: 2, opens: 3 })
  })
})
