import { describe, beforeAll, afterAll, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/short-links/route"

const originalFetch = global.fetch
let fetchMock: jest.Mock

beforeAll(() => {
  process.env.SHORTIO_API_KEY = "test-key"
  process.env.SHORTIO_DOMAIN = "example.com"
})

afterAll(() => {
  global.fetch = originalFetch
})

describe("short links route", () => {
  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock as any
  })

  test("creates short link", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ shortURL: "http://s.io/a", path: "k1", idString: "id1" }),
    } as any)

    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ originalURL: "http://example.com" }),
    })
    const res = await POST(req)
    const body = await res.text()
    expect(body).toBe(
      JSON.stringify({ shortURL: "http://s.io/a", path: "k1", idString: "id1" })
    )
    expect(fetchMock).toHaveBeenCalled()
  })

  test("requires url", async () => {
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify({}) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test("handles shortio error", async () => {
    fetchMock.mockRejectedValue(new Error("bad"))
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ originalURL: "http://ex.com" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("bad")
  })
})
