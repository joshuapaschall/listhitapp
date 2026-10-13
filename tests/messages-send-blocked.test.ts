// A tenant (non-pinned) org whose Twilio rail isn't live must get a clean 409
// sms_not_ready from /api/messages/send — never a Telnyx send, never a Twilio
// client. Routing runs for real against a DB with no Twilio rows for the org.
import { NextRequest } from "next/server"

const h = vi.hoisted(() => {
  const tablesRead: string[] = []
  const client: any = {
    from: (table: string) => {
      tablesRead.push(table)
      if (table === "org_twilio" || table === "org_twilio_credentials") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { client, tablesRead, getClientMock: vi.fn(), fetchMock: vi.fn() }
})

vi.mock("@/lib/supabase", () => ({ supabase: h.client, supabaseAdmin: h.client }))
vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: { id: "u1" }, orgId: "org-tenant", supabase: h.client }),
}))
vi.mock("@/lib/permissions/server", () => ({ requirePermission: async () => null }))
vi.mock("@/lib/twilio/org-client", () => ({
  getTwilioClientForOrg: (...args: any[]) => h.getClientMock(...args),
}))

// @ts-ignore
global.fetch = h.fetchMock

import { POST } from "../app/api/messages/send/route"

describe("messages/send for a blocked tenant", () => {
  beforeEach(() => {
    h.fetchMock.mockReset()
    h.getClientMock.mockReset()
    h.tablesRead.length = 0
    process.env.TELNYX_PINNED_ORG_IDS = "org-owner"
    process.env.TELNYX_API_KEY = "KEY"
    process.env.TELNYX_MESSAGING_PROFILE_ID = "MP"
    process.env.DEFAULT_OUTBOUND_DID = "+19998887777"
  })

  afterAll(() => {
    delete process.env.TELNYX_PINNED_ORG_IDS
  })

  test("409 sms_not_ready; no Telnyx fetch; no Twilio client", async () => {
    const res = await POST(
      new NextRequest("http://test", {
        method: "POST",
        body: JSON.stringify({ buyerId: "b1", to: "+15125550123", body: "hi" }),
      }),
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("sms_not_ready")
    expect(body.error).toBe("Texting isn't set up for your account yet. Finish setup in Get started.")
    expect(h.fetchMock).not.toHaveBeenCalled()
    expect(h.getClientMock).not.toHaveBeenCalled()
    // Refused before any thread/buyer/message work.
    expect(h.tablesRead.every((t) => t === "org_twilio" || t === "org_twilio_credentials")).toBe(true)
  })

  test("the Telnyx configuration check never runs for a tenant (no misleading 500)", async () => {
    delete process.env.TELNYX_API_KEY
    delete process.env.TELNYX_MESSAGING_PROFILE_ID
    const res = await POST(
      new NextRequest("http://test", {
        method: "POST",
        body: JSON.stringify({ to: "+15125550123", body: "hi" }),
      }),
    )
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("sms_not_ready")
  })
})
