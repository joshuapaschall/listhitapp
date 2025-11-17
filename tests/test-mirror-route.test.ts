import { describe, beforeEach, test, expect, jest } from "@jest/globals"
import { GET } from "../app/api/test-mirror/route"
import { NextRequest } from "next/server"

const mirrorMock = jest.fn()

jest.mock("../utils/mms.server", () => ({
  mirrorMediaUrl: (...args: any[]) => mirrorMock(...args),
}))

describe("test mirror route", () => {
  beforeEach(() => {
    mirrorMock.mockReset()
  })

  test("returns mirrored url", async () => {
    mirrorMock.mockResolvedValue("https://cdn/pic.jpg")
    const req = new NextRequest(
      "http://test?url=https://real.example.com/pic.jpg",
    )
    const res = await GET(req)
    expect(mirrorMock).toHaveBeenCalledWith(
      "https://real.example.com/pic.jpg",
      "incoming",
    )
    const data = await res.json()
    expect(data).toEqual({ mirroredUrl: "https://cdn/pic.jpg" })
  })

  test("handles mirror failure", async () => {
    mirrorMock.mockResolvedValue(null)
    const req = new NextRequest(
      "http://test?url=https://real.example.com/pic.jpg",
    )
    const res = await GET(req)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe("Failed to mirror media")
  })
})
