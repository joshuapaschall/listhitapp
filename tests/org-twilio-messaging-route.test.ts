// Auth-gate tests for the org-twilio messaging route. No network calls — the
// orchestrator is mocked; we assert the 401/400/403 gates and that a valid
// platform-admin POST delegates to provisionMessaging(orgId) once.

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
vi.mock("@/lib/twilio/org-client", () => ({
  getTwilioClientForOrg: vi.fn(async () => {
    throw new Error("no network")
  }),
}))
vi.mock("@/lib/org-twilio/provision-messaging", () => ({
  provisionMessaging: h.provisionMock,
}))

import { GET, POST } from "../app/api/org-twilio/messaging/route"

describe("org-twilio messaging route auth", () => {
  beforeEach(() => {
    h.state.authUser = { id: "user-1" }
    h.state.orgId = "org-1"
    h.state.role = "owner"
    // Platform-admin only until Phase 2B: user-1 is on the allowlist.
    process.env.PLATFORM_ADMIN_USER_IDS = "user-1"
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

  test("403 when the user is not a platform admin", async () => {
    h.state.role = "user"
    process.env.PLATFORM_ADMIN_USER_IDS = "someone-else"
    const res = await POST()
    expect(res.status).toBe(403)
    expect(h.provisionMock).not.toHaveBeenCalled()
  })

  test("platform-admin POST provisions once and returns the result", async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    expect(h.provisionMock).toHaveBeenCalledTimes(1)
    expect(h.provisionMock).toHaveBeenCalledWith("org-1")
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, messagingServiceSid: "MG123", campaignSid: "CM123" })
  })

  test("an org owner/admin who is not a platform admin is refused (no carrier filing)", async () => {
    h.state.role = "admin"
    process.env.PLATFORM_ADMIN_USER_IDS = "someone-else"
    const res = await POST()
    expect(res.status).toBe(403)
    expect(h.provisionMock).not.toHaveBeenCalled()
  })

  test("GET is platform-admin only too", async () => {
    process.env.PLATFORM_ADMIN_USER_IDS = "someone-else"
    const res = await GET()
    expect(res.status).toBe(403)
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
