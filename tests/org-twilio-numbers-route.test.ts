// GET /api/org-twilio/numbers/available — searched with the PARENT client (no
// subaccount needed), defaulting the area code to the org's own phone.

const ORG = "44444444-4444-4444-8444-444444444444"

const h = vi.hoisted(() => ({
  orgPhone: "(404) 555-0123" as string | null,
  list: vi.fn(),
  available: vi.fn(),
}))

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: { id: "user-1" }, orgId: "44444444-4444-4444-8444-444444444444" }),
}))
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({
          data: table === "profiles" ? { role: "owner" } : table === "organizations" ? { phone: h.orgPhone } : null,
          error: null,
        }),
      }
      return q
    },
  },
}))
vi.mock("@/lib/twilio/parent", () => ({
  getParentAccountClient: () => ({ availablePhoneNumbers: h.available }),
}))

import { GET } from "../app/api/org-twilio/numbers/available/route"

const get = (qs = "") => GET(new Request(`http://localhost/api/org-twilio/numbers/available${qs}`))

describe("GET /api/org-twilio/numbers/available", () => {
  beforeEach(() => {
    process.env.TELNYX_PINNED_ORG_IDS = "adddfd02-790e-4be7-a0df-047b7dbdd1b8"
    h.orgPhone = "(404) 555-0123"
    h.list.mockReset().mockResolvedValue([
      { phoneNumber: "+14045557777", friendlyName: "(404) 555-7777", locality: "Atlanta", region: "GA" },
    ])
    h.available.mockReset().mockReturnValue({ local: { list: h.list } })
  })

  test("a bad area code → 400, no search", async () => {
    const res = await get("?areaCode=40")
    expect(res.status).toBe(400)
    expect(h.list).not.toHaveBeenCalled()
  })

  test("a bad contains pattern → 400", async () => {
    const res = await get("?areaCode=404&contains=7a")
    expect(res.status).toBe(400)
  })

  test("searches with the parent client and returns friendly rows", async () => {
    const res = await get("?areaCode=512&contains=7777")
    expect(res.status).toBe(200)
    expect(h.available).toHaveBeenCalledWith("US")
    expect(h.list).toHaveBeenCalledWith(
      expect.objectContaining({ areaCode: 512, contains: "7777", smsEnabled: true, voiceEnabled: true, limit: 10 }),
    )
    expect(await res.json()).toEqual({
      results: [{ phoneNumber: "+14045557777", friendly: "(404) 555-7777", locality: "Atlanta", region: "GA" }],
      matchedBy: "area_code",
      searchedAreaCode: "512",
    })
  })

  test("the default area code comes from the org's phone", async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(h.list).toHaveBeenCalledWith(expect.objectContaining({ areaCode: 404 }))
  })

  test("no area code and no org phone → 400", async () => {
    h.orgPhone = null
    const res = await get()
    expect(res.status).toBe(400)
  })
})
