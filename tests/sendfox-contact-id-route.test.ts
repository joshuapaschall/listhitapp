import { describe, test, expect } from "@jest/globals"
import { NextRequest } from "next/server"
import { DELETE } from "../app/api/sendfox/contact/[id]/route"

describe("sendfox contact id route", () => {
  test("returns 405", async () => {
    const req = new NextRequest("http://test", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "42" } })
    expect(res.status).toBe(405)
    const body = await res.json()
    expect(body).toEqual({
      error:
        "SendFox does not support DELETE; use POST /api/sendfox/contact with Deleted list",
    })
  })
})
