import { NextRequest } from "next/server"

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

const state = vi.hoisted(() => ({
  currentUser: { id: "user-1" } as { id: string } | null,
  callerRole: "user",
  permissions: [] as any[],
  campaigns: [] as any[],
  deleted: [] as { table: string; column: string; value: any }[],
  fetchMock: vi.fn(),
  smsMock: vi.fn(),
  emailMock: vi.fn(),
  orgId: "org-1" as string | null,
}))

vi.mock("@/services/campaign-sender.server", () => ({
  sendCampaignSMS: (...args: any[]) => state.smsMock(...args),
}))

vi.mock("@/lib/ses", () => ({
  sendSesEmail: (...args: any[]) => state.emailMock(...args),
}))

function permissionRows() {
  return state.permissions.filter((permission) => permission.granted !== false)
}

function createPermissionQuery(rows: any[]) {
  const query = {
    eq: () => query,
    then: (resolve: any) => resolve({ data: rows, error: null }),
  }
  return query
}

function createDeleteQuery(table: string) {
  return {
    eq: (column: string, value: any) => {
      state.deleted.push({ table, column, value })
      return Promise.resolve({ error: null })
    },
  }
}

function createRouteClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: state.currentUser }, error: null }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: (columns?: string) => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: columns?.includes("role")
                  ? { role: state.callerRole }
                  : { full_name: "Test Sender", display_name: null },
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === "permissions") {
        return {
          select: () => createPermissionQuery(permissionRows()),
        }
      }

      if (table === "campaigns") {
        return {
          select: () => {
            const query: any = {
              filters: [] as { column: string; value: any }[],
              eq(column: string, value: any) {
                query.filters.push({ column, value })
                return query
              },
              maybeSingle: async () => {
                const campaign = state.campaigns.find((row) =>
                  query.filters.every((filter: any) => row[filter.column] === filter.value),
                )
                return { data: campaign ?? null, error: null }
              },
              single: async () => {
                const campaign = state.campaigns.find((row) =>
                  query.filters.every((filter: any) => row[filter.column] === filter.value),
                )
                return { data: campaign ?? null, error: campaign ? null : { message: "not found" } }
              },
            }
            return query
          },
          delete: () => createDeleteQuery(table),
        }
      }

      if (table === "campaign_recipients" || table === "email_campaign_queue" || table === "sms_campaign_queue") {
        return {
          delete: () => createDeleteQuery(table),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
  }
}

vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createRouteHandlerClient: () => createRouteClient(),
}))

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({
    user: state.currentUser,
    orgId: state.orgId,
    supabase: createRouteClient(),
  }),
  resolveOrgIdForUser: async () => state.orgId,
}))

describe("campaign permission gates", () => {
  beforeEach(() => {
    vi.resetModules()
    state.currentUser = { id: "user-1" }
    state.callerRole = "user"
    state.permissions = []
    state.campaigns = []
    state.deleted = []
    state.fetchMock.mockReset().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ ok: true }),
    })
    state.smsMock.mockReset().mockResolvedValue([{ to: "+17705550123", sid: "dry-run", from: "+15555550100" }])
    state.emailMock.mockReset().mockResolvedValue(undefined)
    state.orgId = "org-1"
    ;(global as any).fetch = state.fetchMock
    process.env.CRON_SECRET = "cron-secret"
    process.env.DISPOTOOL_BASE_URL = ""
    process.env.SITE_URL = ""
    process.env.LISTHIT_DRY_RUN = "1"
  })

  function grant(permission: "campaigns.send_sms" | "campaigns.send_email" | "campaigns.view") {
    state.permissions = [{ user_id: "user-1", permission_key: permission, granted: true }]
  }

  async function postSendNow(campaignId: string) {
    const { POST } = await import("../app/api/campaigns/send-now/route")
    const req = new NextRequest("http://test/api/campaigns/send-now", {
      method: "POST",
      body: JSON.stringify({ campaignId }),
    })
    return POST(req)
  }

  async function postSmsTest() {
    const { POST } = await import("../app/api/campaigns/test-send-sms/route")
    const req = new NextRequest("http://test/api/campaigns/test-send-sms", {
      method: "POST",
      body: JSON.stringify({ campaignId: "sms-1", testPhone: "+1 (770) 555-0123", forceDryRun: true }),
    })
    return POST(req)
  }

  async function postEmailTest() {
    const { POST } = await import("../app/api/campaigns/test-send/route")
    const req = new NextRequest("http://test/api/campaigns/test-send", {
      method: "POST",
      body: JSON.stringify({ to: "buyer@example.com", subject: "Test", html: "<p>Hello</p>" }),
    })
    return POST(req)
  }

  async function postDelete() {
    const { POST } = await import("../app/api/campaigns/delete/route")
    const req = new NextRequest("http://test/api/campaigns/delete", {
      method: "POST",
      body: JSON.stringify({ campaignId: "delete-1" }),
    })
    return POST(req)
  }

  describe("POST /api/campaigns/send-now", () => {
    test("denies SMS campaigns without campaigns.send_sms", async () => {
      state.campaigns = [{ id: "sms-1", org_id: "org-1", user_id: "user-1", channel: "sms" }]

      const res = await postSendNow("sms-1")

      expect(res.status).toBe(403)
      expect(state.fetchMock).not.toHaveBeenCalled()
    })

    test("allows SMS campaigns with campaigns.send_sms", async () => {
      state.campaigns = [{ id: "sms-1", org_id: "org-1", user_id: "user-1", channel: "sms" }]
      grant("campaigns.send_sms")

      const res = await postSendNow("sms-1")

      expect(res.status).toBe(200)
      expect(state.fetchMock).toHaveBeenCalledWith(
        "http://test/api/campaigns/send",
        expect.objectContaining({ method: "POST" }),
      )
    })

    test("allows SMS campaigns for admins", async () => {
      state.campaigns = [{ id: "sms-1", org_id: "org-1", user_id: "user-1", channel: "sms" }]
      state.callerRole = "admin"

      const res = await postSendNow("sms-1")

      expect(res.status).toBe(200)
    })

    test("denies email campaigns without campaigns.send_email", async () => {
      state.campaigns = [{ id: "email-1", org_id: "org-1", user_id: "user-1", channel: "email" }]

      const res = await postSendNow("email-1")

      expect(res.status).toBe(403)
      expect(state.fetchMock).not.toHaveBeenCalled()
    })

    test("allows email campaigns with campaigns.send_email", async () => {
      state.campaigns = [{ id: "email-1", org_id: "org-1", user_id: "user-1", channel: "email" }]
      grant("campaigns.send_email")

      const res = await postSendNow("email-1")

      expect(res.status).toBe(200)
      expect(state.fetchMock).toHaveBeenCalled()
    })

    test("allows email campaigns for admins", async () => {
      state.campaigns = [{ id: "email-1", org_id: "org-1", user_id: "user-1", channel: "email" }]
      state.callerRole = "admin"

      const res = await postSendNow("email-1")

      expect(res.status).toBe(200)
    })
  })

  test("gates SMS test sends on campaigns.send_sms", async () => {
    state.campaigns = [{ id: "sms-1", org_id: "org-1", user_id: "user-1", channel: "sms", status: "draft", message: "Hi {{fname}}" }]

    const denied = await postSmsTest()
    expect(denied.status).toBe(403)
    expect(state.smsMock).not.toHaveBeenCalled()

    grant("campaigns.send_sms")
    const allowed = await postSmsTest()
    expect(allowed.status).toBe(200)
    expect(state.smsMock).toHaveBeenCalled()
  })

  test("gates email test sends on campaigns.send_email", async () => {
    const denied = await postEmailTest()
    expect(denied.status).toBe(403)
    expect(state.emailMock).not.toHaveBeenCalled()

    grant("campaigns.send_email")
    const allowed = await postEmailTest()
    expect(allowed.status).toBe(200)
    expect(state.emailMock).toHaveBeenCalledWith({
      to: "buyer@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    })
  })

  describe("POST /api/campaigns/delete", () => {
    beforeEach(() => {
      state.campaigns = [{ id: "delete-1", org_id: "org-1", user_id: "user-1", channel: "sms", status: "draft" }]
    })

    test("denies users with only campaigns.view", async () => {
      grant("campaigns.view")

      const res = await postDelete()

      expect(res.status).toBe(403)
      expect(state.deleted).toEqual([])
    })

    test("allows users with a campaign send permission", async () => {
      grant("campaigns.send_email")

      const res = await postDelete()

      expect(res.status).toBe(200)
      expect(state.deleted.map((entry) => entry.table)).toEqual([
        "email_campaign_queue",
        "sms_campaign_queue",
        "campaign_recipients",
        "campaigns",
      ])
    })

    test("allows admins", async () => {
      state.callerRole = "admin"

      const res = await postDelete()

      expect(res.status).toBe(200)
    })
  })
})
