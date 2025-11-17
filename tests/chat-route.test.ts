import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"

let POST: any
const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock

describe("chat route", () => {
  beforeEach(async () => {
    fetchMock.mockReset()
    process.env.OPENAI_API_KEY = "key"
    jest.resetModules()
    POST = (await import("../app/api/chat/route")).POST
  })

  test("forwards messages to OpenAI", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Hi" } }] }),
    })
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(fetchMock).toHaveBeenCalled()
    expect(body).toEqual({ content: "Hi" })
  })

  test("validates input", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test("throws when API key missing at import", async () => {
    delete process.env.OPENAI_API_KEY
    jest.resetModules()
    await expect(import("../app/api/chat/route")).rejects.toThrow(
      "OpenAI API key not configured",
    )
  })

  test("rejects oversized payload", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ messages: new Array(21).fill({ role: "user", content: "x" }) }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
