import { NextRequest } from "next/server"
import { beforeEach, describe, expect, test, vi } from "vitest"

const createMock = vi.fn()

// Creating short links now requires an authenticated session via requireOrgContext.
vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: vi.fn(async () => ({ user: { id: "u1" }, orgId: "org1", supabase: {} })),
}))

vi.mock("../services/shortlink-service", () => ({
  createShortLink: (...args: unknown[]) => createMock(...args),
}))

let POST: typeof import("../app/api/short-links/route").POST

beforeEach(async () => {
  vi.resetModules()
  createMock.mockReset()
  process.env.SHORT_LINK_DEFAULT_DOMAIN = "go.example.com"
  vi.doMock("@/lib/auth/org-context", () => ({
    requireOrgContext: vi.fn(async () => ({ user: { id: "u1" }, orgId: "org1", supabase: {} })),
  }))
  vi.doMock("../services/shortlink-service", () => ({
    createShortLink: (...args: unknown[]) => createMock(...args),
  }))
  ;({ POST } = await import("../app/api/short-links/route"))
})

describe("short links route", () => {
  test("creates short link with native shape preserved", async () => {
    createMock.mockResolvedValue({
      id: "row-1",
      slug: "abc1234",
      domain: "go.example.com",
      shortUrl: "https://go.example.com/abc1234",
      targetUrl: "https://example.com",
    })

    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ originalURL: "https://example.com" }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body).toEqual({
      shortURL: "https://go.example.com/abc1234",
      path: "abc1234",
      idString: "row-1",
    })
    expect(createMock).toHaveBeenCalledWith({
      targetUrl: "https://example.com",
      slug: undefined,
    })
  })

  test("requires originalURL", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test("handles service errors", async () => {
    createMock.mockRejectedValue(new Error("bad"))
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ originalURL: "https://ex.com" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("bad")
  })
})
