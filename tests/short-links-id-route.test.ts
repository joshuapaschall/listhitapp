import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"

let PATCH: any
let DELETE_METHOD: any
const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock

describe("short links id route", () => {
  beforeEach(async () => {
    jest.resetModules()
    fetchMock.mockReset()
    process.env.SHORTIO_API_KEY = "KEY"
    PATCH = (await import("../app/api/short-links/[id]/route")).PATCH
    DELETE_METHOD = (await import("../app/api/short-links/[id]/route")).DELETE
  })

  test("updates slug", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ path: "new" }) })
    const req = new NextRequest("http://test", {
      method: "PATCH",
      body: JSON.stringify({ path: "new" }),
    })
    const res = await PATCH(req, { params: { id: "id1" } })
    const body = await res.json()
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.short.io/links/id1",
      {
        method: "POST",
        headers: { Authorization: "KEY", "Content-Type": "application/json" },
        body: JSON.stringify({ path: "new" }),
      },
    )
    expect(body).toEqual({ path: "new" })
  })

  test("requires path", async () => {
    const req = new NextRequest("http://test", {
      method: "PATCH",
      body: JSON.stringify({}),
    })
    const res = await PATCH(req, { params: { id: "id1" } })
    expect(res.status).toBe(400)
  })

  test("handles shortio error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => "bad" })
    const req = new NextRequest("http://test", {
      method: "PATCH",
      body: JSON.stringify({ path: "x" }),
    })
    const res = await PATCH(req, { params: { id: "id1" } })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain("bad")
  })

  test("deletes link", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    const req = new NextRequest("http://test", { method: "DELETE" })
    const res = await DELETE_METHOD(req, { params: { id: "id1" } })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.short.io/links/id1",
      { method: "DELETE", headers: { Authorization: "KEY" } },
    )
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })
})
