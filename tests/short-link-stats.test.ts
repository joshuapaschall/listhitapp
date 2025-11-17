import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"
import { GET } from "../app/api/short-links/clicks/route"

let clicksMock = jest.fn()

jest.mock("../services/shortio-service", () => ({
  getShortLinkClicks: (...args: any[]) => clicksMock(...args),
}))

describe("short link stats route", () => {
  beforeEach(() => {
    clicksMock.mockReset()
  })

  test("returns click count", async () => {
    clicksMock.mockResolvedValue(5)
    const req = new NextRequest("http://test?key=k1")
    const res = await GET(req)
    const body = await res.text()
    expect(body).toBe(JSON.stringify({ clicks: 5 }))
  })

  test("requires key", async () => {
    const req = new NextRequest("http://test")
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
