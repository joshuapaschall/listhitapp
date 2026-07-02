// Auth-gate tests for the org-twilio messaging route. No network calls — the
// orchestrator is mocked; we assert the 401/400/403 gates and that a valid
// owner POST delegates to provisionMessaging(orgId) once.

const h = vi.hoisted(() => {
  const state = {
    authUser: { id: "user-1" } as { id: string } | null,
    orgId: "org-1" as string | null,
    role: "owner" as string,
  }

  const client: any = {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role: state.role }, error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }

  return { state, client, provisionMock: vi.fn() }
})

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.client, supabase: h.client }))
vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: h.state.authUser, orgId: h.state.orgId }),
}))
vi.mock("@/lib/org-twilio/service", () => ({
  getOrgTwilio: vi.fn(async () => null),
  upsertOrgTwilio: vi.fn(async () => null),
}))
vi.mock("@/lib/providers/twilio/client", () => ({
  getTwilioClient: vi.fn(() => {
    throw new Error("no network")
  }),
}))
vi.mock("@/lib/org-twilio/provision-messaging", () => ({
  provisionMessaging: h.provisionMock,
}))

import { POST } from "../app/api/org-twilio/messaging/route"

describe("org-twilio messaging route auth", () => {
  beforeEach(() => {
    h.state.authUser = { id: "user-1" }
    h.state.orgId = "org-1"
    h.state.role = "owner"
    h.provisionMock.mockReset().mockResolvedValue({
      ok: true,
      messagingServiceSid: "MG123",
      campaignSid: "CM123",
      campaignStatus: "PENDING",
      phoneNumber: "+14705550123",
    })
  })

  test("401 when there is no user", async () => {
    h.state.authUser = null
    const res = await POST()
    expect(res.status).toBe(401)
    expect(h.provisionMock).not.toHaveBeenCalled()
  })

  test("400 when there is no org", async () => {
    h.state.orgId = null
    const res = await POST()
    expect(res.status).toBe(400)
    expect(h.provisionMock).not.toHaveBeenCalled()
  })

  test("403 when the user is not owner/admin", async () => {
    h.state.role = "user"
    const res = await POST()
    expect(res.status).toBe(403)
    expect(h.provisionMock).not.toHaveBeenCalled()
  })

  test("owner POST provisions once and returns the result", async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    expect(h.provisionMock).toHaveBeenCalledTimes(1)
    expect(h.provisionMock).toHaveBeenCalledWith("org-1")
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, messagingServiceSid: "MG123", campaignSid: "CM123" })
  })

  test("admin role is allowed", async () => {
    h.state.role = "admin"
    const res = await POST()
    expect(res.status).toBe(200)
    expect(h.provisionMock).toHaveBeenCalledTimes(1)
  })

  test("propagates a provisioning failure as 400", async () => {
    h.provisionMock.mockResolvedValueOnce({
      ok: false,
      error: "Brand not filed yet. File the brand first.",
    })
    const res = await POST()
    expect(res.status).toBe(400)
  })
})
