import { NextRequest } from "next/server"

const h = vi.hoisted(() => {
  const selectBuyerMock = vi.fn(() => ({
    eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { email: "a@test.com" }, error: null })) })),
  }))

  const updateMock = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }))

  const fromMock = vi.fn((table: string) => {
    if (table === "buyers") return { select: selectBuyerMock, update: updateMock }
    return { select: selectBuyerMock, update: updateMock }
  })

  return { fromMock, selectBuyerMock, updateMock }
})

vi.mock("@/lib/auth/scoped-db", () => ({
  getOrgScopedClient: vi.fn(async () => ({
    user: { id: "user-1" },
    orgId: "org-1",
    supabase: { from: h.fromMock },
  })),
}))


import { POST } from "../app/api/buyers/[id]/unsubscribe/route"

describe("buyer unsubscribe route", () => {
  test("unsubscribes buyer", async () => {
    const req = new NextRequest("http://test", { method: "POST" })
    const res = await POST(req, { params: { id: "1" } })
    expect(res.status).toBe(200)
    expect(h.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        can_receive_sms: false,
        can_receive_email: false,
        email_suppressed: true,
        sms_suppressed: true,
        sms_suppressed_reason: "unsubscribe",
        is_unsubscribed: true,
        sms_suppressed_at: expect.any(String),
        unsubscribed_at: expect.any(String),
      }),
    )
  })
})
