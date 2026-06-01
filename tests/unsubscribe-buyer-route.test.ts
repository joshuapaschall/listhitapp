import { NextRequest } from "next/server"

const h = vi.hoisted(() => {
  const sendfox = {
    unsubscribe: vi.fn(async () => {}),
    findContactByEmail: vi.fn(async () => ({ id: 1 })),
    removeContactFromList: vi.fn(async () => {}),
  }

  const selectBuyerMock = vi.fn(() => ({
    eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { email: "a@test.com" }, error: null })) })),
  }))

  const selectBuyerGroupMock = vi.fn(() => ({
    eq: vi.fn(async () => ({ data: [{ groups: { sendfox_list_id: 5 } }], error: null })),
  }))

  const updateMock = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }))

  const fromMock = vi.fn((table: string) => {
    if (table === "buyers") return { select: selectBuyerMock, update: updateMock }
    if (table === "buyer_groups") return { select: selectBuyerGroupMock }
    return { select: selectBuyerMock, update: updateMock }
  })

  return { fromMock, selectBuyerMock, sendfox, updateMock }
})

vi.mock("@/lib/auth/scoped-db", () => ({
  getOrgScopedClient: vi.fn(async () => ({
    user: { id: "user-1" },
    orgId: "org-1",
    supabase: { from: h.fromMock },
  })),
}))

vi.mock("../services/sendfox-service", () => ({
  unsubscribe: (...args: any[]) => h.sendfox.unsubscribe(...args),
  findContactByEmail: (...args: any[]) => h.sendfox.findContactByEmail(...args),
  removeContactFromList: (...args: any[]) => h.sendfox.removeContactFromList(...args),
}))

import { POST } from "../app/api/buyers/[id]/unsubscribe/route"

describe("buyer unsubscribe route", () => {
  test("unsubscribes buyer", async () => {
    const req = new NextRequest("http://test", { method: "POST" })
    const res = await POST(req, { params: { id: "1" } })
    expect(res.status).toBe(200)
    expect(h.sendfox.findContactByEmail).toHaveBeenCalledWith("a@test.com")
    expect(h.sendfox.removeContactFromList).toHaveBeenCalledWith(5, 1)
    expect(h.sendfox.unsubscribe).toHaveBeenCalledWith("a@test.com")
    expect(h.updateMock).toHaveBeenCalledWith({
      can_receive_sms: false,
      can_receive_email: false,
    })
  })
})
