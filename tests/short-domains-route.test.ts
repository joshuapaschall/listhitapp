import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"

let GET: any
let POST: any
let DELETE_METHOD: any
const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock

describe("short domains routes", () => {
  beforeEach(async () => {
    jest.resetModules()
    fetchMock.mockReset()
    process.env.SHORTIO_API_KEY = "KEY"
    const mod = await import("../app/api/short-domains/route")
    GET = mod.GET
    POST = mod.POST
    DELETE_METHOD = (await import("../app/api/short-domains/[id]/route")).DELETE
  })

  test("lists domains", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ id: "d1" }] })
    const res = await GET()
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.short.io/api/domains",
      { headers: { Authorization: "KEY" } },
    )
    const body = await res.json()
    expect(body).toEqual([{ id: "d1" }])
  })

  test("creates domain", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: "d1" }) })
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ hostname: "ex.com" }),
    })
    const res = await POST(req)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.short.io/api/domains",
      {
        method: "POST",
        headers: { Authorization: "KEY", "Content-Type": "application/json" },
        body: JSON.stringify({ hostname: "ex.com", linkType: "random" }),
      },
    )
    const body = await res.json()
    expect(body).toEqual({ id: "d1" })
  })

  test("deletes domain", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    const req = new NextRequest("http://test", { method: "DELETE" })
    const res = await DELETE_METHOD(req, { params: { id: "123" } })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.short.io/api/domains/delete/123",
      { method: "POST", headers: { Authorization: "KEY" } },
    )
    const body = await res.json()
    expect(body).toEqual({})
  })
})
