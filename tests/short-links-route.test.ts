import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { POST } from "../app/api/short-links/route"

let createMock = jest.fn()

jest.mock("../services/shortio-service", () => ({
  createShortLink: (...args: any[]) => createMock(...args),
}))

describe("short links route", () => {
  beforeEach(() => {
    createMock.mockReset()
  })

  test("creates short link", async () => {
    createMock.mockResolvedValue({
      shortURL: "http://s.io/a",
      path: "k1",
      idString: "id1",
    })
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ originalURL: "http://example.com" }),
    })
    const res = await POST(req)
    const body = await res.text()
    expect(body).toBe(
      JSON.stringify({ shortURL: "http://s.io/a", path: "k1", idString: "id1" })
    )
    expect(createMock).toHaveBeenCalledWith("http://example.com", undefined)
  })

  test("requires url", async () => {
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify({}) })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test("handles shortio error", async () => {
    createMock.mockRejectedValue(new Error("bad"))
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
