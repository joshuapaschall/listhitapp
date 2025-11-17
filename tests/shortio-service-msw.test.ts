import { describe, beforeAll, afterAll, afterEach, test, expect } from "@jest/globals"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { createShortLink } from "../services/shortio-service"

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("createShortLink using msw", () => {
  test("returns short link data", async () => {
    process.env.SHORTIO_API_KEY = "KEY"
    process.env.SHORTIO_DOMAIN = "d.short.io"
    server.use(
      http.post("https://api.short.io/links", async () => {
        return HttpResponse.json({ shortURL: "http://s.io/a", path: "k1", idString: "id1" })
      })
    )
    const result = await createShortLink("https://example.com/page")
    expect(result).toEqual({ shortURL: "http://s.io/a", path: "k1", idString: "id1" })
  })

  test("throws error on failure", async () => {
    process.env.SHORTIO_API_KEY = "KEY"
    process.env.SHORTIO_DOMAIN = "d.short.io"
    server.use(
      http.post("https://api.short.io/links", () => {
        return HttpResponse.text("fail", { status: 500 })
      })
    )
    await expect(createShortLink("https://example.com/page")).rejects.toThrow(
      "Short.io error 500: fail"
    )
  })
})
