import { NextRequest } from "next/server"
import { beforeEach, describe, expect, test, vi } from "vitest"

const clicksMock = vi.fn()

vi.mock("../services/shortlink-service", () => ({
  getShortLinkClicks: (...args: unknown[]) => clicksMock(...args),
}))

let GET: typeof import("../app/api/short-links/clicks/route").GET

beforeEach(async () => {
  vi.resetModules()
  clicksMock.mockReset()
  vi.doMock("../services/shortlink-service", () => ({
    getShortLinkClicks: (...args: unknown[]) => clicksMock(...args),
  }))
  ;({ GET } = await import("../app/api/short-links/clicks/route"))
})

describe("short link stats route", () => {
  test("returns click count", async () => {
    clicksMock.mockResolvedValue(5)
    const req = new NextRequest("http://test?key=k1")
    const res = await GET(req)
    const body = await res.json()
    expect(body).toEqual({ clicks: 5 })
  })

  test("requires key", async () => {
    const req = new NextRequest("http://test")
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
