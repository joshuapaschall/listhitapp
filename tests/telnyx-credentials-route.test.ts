import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { GET } from "../app/api/telnyx/credentials/route"

const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock

describe("telnyx credentials route", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: ["c1"] }) })
    process.env.TELNYX_API_KEY = "KEY"
  })

  test("returns credentials", async () => {
    const res = await GET()
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telnyx.com/v2/telephony_credentials",
      { headers: { Authorization: "Bearer KEY" } },
    )
    const data = await res.json()
    expect(data).toEqual({ data: ["c1"] })
  })

  test("handles missing key", async () => {
    process.env.TELNYX_API_KEY = ""
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
