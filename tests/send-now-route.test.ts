import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/campaigns/send-now/route"

const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock

describe("send-now route", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    process.env.DISPOTOOL_BASE_URL = ""
    process.env.SITE_URL = ""
    process.env.SUPABASE_SERVICE_ROLE_KEY = "tok"
  })

  test("adds Authorization header", async () => {
    fetchMock.mockResolvedValue({ status: 200, text: async () => "{}" })
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ campaignId: "c1" }),
      headers: { "Content-Type": "application/json" },
    })

    await POST(req)

    expect(fetchMock).toHaveBeenCalledWith(
      "http://test/api/campaigns/send",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer tok",
        }),
      }),
    )
  })

  test("falls back to request origin", async () => {
    fetchMock.mockResolvedValue({ status: 200, text: async () => "{}" })
    const req = new NextRequest("http://origin", {
      method: "POST",
      body: JSON.stringify({ campaignId: "c1" }),
      headers: { "Content-Type": "application/json" },
    })

    await POST(req)

    expect(fetchMock).toHaveBeenCalledWith(
      "http://origin/api/campaigns/send",
      expect.anything(),
    )
  })
})
