// A showing for a buyer in a tenant org whose texting isn't set up: the SMS is
// skipped (no throw, no Telnyx, no message rows) and the email still goes out.

const h = vi.hoisted(() => {
  const writes: Array<{ table: string; op: string }> = []
  const client: any = {
    from: (table: string) => {
      if (table === "buyers") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { org_id: "org-tenant" }, error: null }) }),
          }),
        }
      }
      if (table === "org_twilio" || table === "org_twilio_credentials") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
      }
      if (table === "messages" || table === "message_threads") {
        const record = (op: string) => {
          writes.push({ table, op })
          const q: any = { select: () => q, eq: () => q, single: async () => ({ data: { id: "t1" }, error: null }) }
          return q
        }
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
          insert: () => record("insert"),
          update: () => record("update"),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { client, writes, sendEmail: vi.fn(), fetchMock: vi.fn(), insertNotification: vi.fn() }
})

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: h.client }))
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.client, supabase: h.client }))
vi.mock("@/lib/email/send-platform-email", () => ({ sendPlatformEmail: h.sendEmail }))
vi.mock("@/lib/org-identity.server", () => ({
  getOrgIdentity: async () => ({
    companyName: "Acme Homes",
    addressLines: ["1 Main St", "Austin, TX 78701"],
    addressSingleLine: "1 Main St, Austin, TX 78701",
    hasCompleteAddress: true,
    phone: null,
    websiteUrl: null,
  }),
}))
vi.mock("@/lib/notifications", () => ({ insertNotification: h.insertNotification }))

// @ts-ignore
global.fetch = h.fetchMock

import { sendShowingConfirmation, sendShowingReminder } from "@/lib/showing-notifications"

const showing: any = { id: "s1", org_id: "org-tenant", buyer_id: "b1", property_id: "p1", scheduled_at: "2026-10-20T15:00:00Z" }
const buyer: any = {
  id: "b1",
  fname: "Jane",
  full_name: "Jane Doe",
  phone: "+15125550123",
  email: "jane@buyer.test",
  can_receive_sms: true,
  can_receive_email: true,
}
const property: any = { id: "p1", address: "1 Main St" }

describe("showing notifications for a blocked tenant", () => {
  beforeEach(() => {
    h.writes.length = 0
    h.sendEmail.mockReset().mockResolvedValue({ sent: true })
    h.fetchMock.mockReset()
    h.insertNotification.mockReset()
    process.env.TELNYX_PINNED_ORG_IDS = "org-owner"
    process.env.DEFAULT_OUTBOUND_DID = "+19998887777"
    process.env.TELNYX_MESSAGING_PROFILE_ID = "MP"
  })

  afterAll(() => {
    delete process.env.TELNYX_PINNED_ORG_IDS
  })

  test.each([
    ["confirmation", sendShowingConfirmation],
    ["reminder", sendShowingReminder],
  ])("%s: SMS skipped without throwing, email still sends", async (_label, send) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await expect(send(showing, buyer, property)).resolves.toBeUndefined()

    expect(h.fetchMock).not.toHaveBeenCalled()
    expect(h.writes).toEqual([])
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(h.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "jane@buyer.test", category: "showing" }))
    // Buyer-facing: the tenant's brand, not ListHit's.
    expect(h.sendEmail.mock.calls[0][0].html).toContain("Acme Homes")
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("texting isn't set up"))
    warn.mockRestore()
  })
})
