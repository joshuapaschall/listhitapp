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

describe("messages schedule route", () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    ensureMock.mockClear()
    insertedRow = null
    process.env.TELNYX_API_KEY = "test-key"
    process.env.TELNYX_MESSAGING_PROFILE_ID = "profile"
  })

  test("sends scheduled payload to telnyx and records message", async () => {
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
})
