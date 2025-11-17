import { describe, test, expect, jest } from "@jest/globals"
import { NextRequest } from "next/server"

const sendfox = {
  unsubscribe: jest.fn(async () => {}),
  findContactByEmail: jest.fn(async () => ({ id: 1 })),
  removeContactFromList: jest.fn(async () => {}),
}

const selectBuyerMock = jest.fn(() => ({
  eq: jest.fn(() => ({ single: jest.fn(async () => ({ data: { email: "a@test.com" }, error: null })) })),
}))

const selectBuyerGroupMock = jest.fn(() => ({
  eq: jest.fn(async () => ({ data: [{ groups: { sendfox_list_id: 5 } }], error: null })),
}))

let updateData: any
const updateMock = jest.fn((data) => {
  updateData = data
  return {
    eq: jest.fn(async () => ({ error: null })),
  }
})

const fromMock = jest.fn((table: string) => {
  if (table === "buyers") return { select: selectBuyerMock, update: updateMock }
  if (table === "buyer_groups") return { select: selectBuyerGroupMock }
  return { select: selectBuyerMock, update: updateMock }
})

jest.mock("../lib/supabase", () => ({
  supabaseAdmin: { from: fromMock },
}))

jest.mock("../services/sendfox-service", () => ({
  unsubscribe: (...args: any[]) => sendfox.unsubscribe(...args),
  findContactByEmail: (...args: any[]) => sendfox.findContactByEmail(...args),
  removeContactFromList: (...args: any[]) => sendfox.removeContactFromList(...args),
}))

import { POST } from "../app/api/buyers/[id]/unsubscribe/route"

describe("buyer unsubscribe route", () => {
  test("unsubscribes buyer", async () => {
    const req = new NextRequest("http://test", { method: "POST" })
    const res = await POST(req, { params: { id: "1" } })
    expect(res.status).toBe(200)
    expect(sendfox.findContactByEmail).toHaveBeenCalledWith("a@test.com")
    expect(sendfox.removeContactFromList).toHaveBeenCalledWith(5, 1)
    expect(sendfox.unsubscribe).toHaveBeenCalledWith("a@test.com")
    expect(updateMock).toHaveBeenCalledWith({
      can_receive_sms: false,
      can_receive_email: false,
    })
  })
})
