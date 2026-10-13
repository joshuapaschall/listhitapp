import { NextRequest } from "next/server"

const fetchMock = vi.fn()
const ensureMock = vi.fn(async (urls: string[]) => urls)
let insertedRow: any = null

// @ts-ignore
global.fetch = fetchMock

vi.mock("next/headers", () => ({
  cookies: () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}))

// The route resolves the org with requireOrgContext and stamps org_id on the cookie client.
// This client handles both requirePermission (profiles/permissions) and the messages insert.
function createOrgClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "admin" }, error: null }) }) }) }
      }
      if (table === "permissions") {
        const query = { eq: () => query, then: (resolve: any) => resolve({ data: [], error: null }) }
        return { select: () => query }
      }
      if (table === "messages") {
        return {
          insert: (row: any) => ({
            select: () => ({
              single: async () => {
                insertedRow = row
                return {
                  data: { id: "db1", created_at: "2024-01-01T00:00:00.000Z" },
                  error: null,
                }
              },
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
}

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: { id: "user-1" }, orgId: "org-1", supabase: createOrgClient() }),
  resolveOrgIdForUser: async () => "org-1",
}))

vi.mock("@/utils/mms.server", () => ({
  ensurePublicMediaUrls: (...args: any[]) => ensureMock(...args),
}))

// Tenant (non-pinned) path: readiness, routing state and the org's own client.
const h = vi.hoisted(() => ({
  readiness: "blocked" as string,
  createMock: vi.fn(),
  getClientMock: vi.fn(),
}))
vi.mock("@/lib/providers/sms", async (importOriginal) => {
  const actual = await importOriginal<any>()
  return { ...actual, getSmsReadiness: async () => h.readiness }
})
vi.mock("@/lib/providers/routing-state", () => ({
  loadRoutingState: async () => ({ messaging_service_sid: "MG-org1" }),
}))
vi.mock("@/lib/twilio/org-client", () => ({
  getTwilioClientForOrg: (...args: any[]) => h.getClientMock(...args),
}))

const tenantReq = (sendAt: string) =>
  new NextRequest("http://localhost/api/messages/schedule", {
    method: "POST",
    body: JSON.stringify({
      buyerId: "buyer-1",
      threadId: "thread-1",
      to: "+12223334444",
      from: "+15556667777",
      body: "Hello world",
      sendAt,
    }),
  })

describe("messages schedule route", () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    ensureMock.mockClear()
    insertedRow = null
    process.env.TELNYX_API_KEY = "test-key"
    process.env.TELNYX_MESSAGING_PROFILE_ID = "profile"
    // org-1 is the pinned owner org unless a test says otherwise.
    process.env.TELNYX_PINNED_ORG_IDS = "org-1"
    h.readiness = "blocked"
    h.createMock.mockReset().mockResolvedValue({ sid: "SM-sched" })
    h.getClientMock.mockReset().mockResolvedValue({ messages: { create: h.createMock } })
  })

  afterAll(() => {
    delete process.env.TELNYX_PINNED_ORG_IDS
  })

  test("pinned owner org sends scheduled payload to telnyx and records message", async () => {
    const sendAt = "2024-01-01T12:30:00.000Z"
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { id: "telnyx-123" } }),
    })

    const mod = await import("@/app/api/messages/schedule/route")
    const req = new NextRequest("http://localhost/api/messages/schedule", {
      method: "POST",
      body: JSON.stringify({
        buyerId: "buyer-1",
        threadId: "thread-1",
        to: "+12223334444",
        from: "+15556667777",
        body: "Hello world",
        mediaUrls: ["http://cdn.test/img.jpg"],
        sendAt,
      }),
    })

    const res = await mod.POST(req)

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/messages/schedule"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(sendAt),
      }),
    )
    const payload = JSON.parse((fetchMock.mock.calls[0]?.[1] as any).body)
    expect(payload).toMatchObject({
      from: "+15556667777",
      to: "+12223334444",
      text: "Hello world",
      send_at: sendAt,
      type: "MMS",
    })
    expect(payload.media_urls).toEqual(["http://cdn.test/img.jpg"])
    expect(ensureMock).toHaveBeenCalledWith(["http://cdn.test/img.jpg"], "outgoing")
    expect(insertedRow).toMatchObject({
      thread_id: "thread-1",
      buyer_id: "buyer-1",
      status: "scheduled",
      provider_id: "telnyx-123",
      org_id: "org-1",
    })
  })

  test("non-pinned org whose texting isn't live → 409 sms_not_ready, no Telnyx, no Twilio", async () => {
    process.env.TELNYX_PINNED_ORG_IDS = "org-owner"
    const mod = await import("@/app/api/messages/schedule/route")
    const res = await mod.POST(tenantReq(new Date(Date.now() + 60 * 60 * 1000).toISOString()))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: "sms_not_ready" })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(h.getClientMock).not.toHaveBeenCalled()
    expect(insertedRow).toBeNull()
  })

  test("non-pinned live org schedules through its own Twilio Messaging Service", async () => {
    process.env.TELNYX_PINNED_ORG_IDS = "org-owner"
    h.readiness = "twilio"
    const sendAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    const mod = await import("@/app/api/messages/schedule/route")
    const res = await mod.POST(tenantReq(sendAt))

    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(h.getClientMock).toHaveBeenCalledWith("org-1")
    const arg = h.createMock.mock.calls[0][0]
    expect(arg).toMatchObject({
      messagingServiceSid: "MG-org1",
      to: "+12223334444",
      body: "Hello world",
      scheduleType: "fixed",
    })
    expect(arg.sendAt).toBeInstanceOf(Date)
    expect((arg.sendAt as Date).toISOString()).toBe(sendAt)
    expect(insertedRow).toMatchObject({ provider_id: "SM-sched", status: "scheduled", org_id: "org-1" })
  })

  test.each([
    ["under 15 minutes out", 5 * 60 * 1000],
    ["over 35 days out", 36 * 24 * 60 * 60 * 1000],
  ])("non-pinned live org: %s → 400 schedule_window", async (_label, leadMs) => {
    process.env.TELNYX_PINNED_ORG_IDS = "org-owner"
    h.readiness = "twilio"
    const mod = await import("@/app/api/messages/schedule/route")
    const res = await mod.POST(tenantReq(new Date(Date.now() + leadMs).toISOString()))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: "schedule_window" })
    expect(h.createMock).not.toHaveBeenCalled()
  })
})
