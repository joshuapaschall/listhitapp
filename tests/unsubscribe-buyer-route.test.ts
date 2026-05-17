import { NextRequest } from "next/server"

const sendfox = {
  unsubscribe: vi.fn(async () => {}),
  findContactByEmail: vi.fn(async () => ({ id: 1 })),
  removeContactFromList: vi.fn(async () => {}),
}

const selectBuyerMock = vi.fn(() => ({
  eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { email: "a@test.com" }, error: null })) })),
}))

const selectBuyerGroupMock = vi.fn(() => ({
  eq: vi.fn(async () => ({ data: [{ groups: { sendfox_list_id: 5 } }], error: null })),
}))

let updateData: any
const updateMock = vi.fn((data) => {
  updateData = data
  return {
    eq: vi.fn(async () => ({ error: null })),
  }
})

const fromMock = vi.fn((table: string) => {
  if (table === "buyers") return { select: selectBuyerMock, update: updateMock }
  if (table === "buyer_groups") return { select: selectBuyerGroupMock }
  return { select: selectBuyerMock, update: updateMock }
})

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: { from: fromMock },
}))

vi.mock("../services/sendfox-service", () => ({
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
