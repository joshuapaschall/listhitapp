import { NextRequest } from "next/server"
import { vi } from "vitest"

const H = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  orgId: "org-1" as string | null,
  resolveMock: vi.fn(),
}))

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: vi.fn(async () => ({ user: H.user, orgId: H.orgId, supabase: {} })),
}))
vi.mock("@/lib/campaigns/resolve-audience-ids", () => ({
  resolveAudienceIds: H.resolveMock,
}))

import { POST } from "../app/api/campaigns/audience/count/route"

function post(bodyOrRaw: unknown, raw = false) {
  return POST(
    new NextRequest("http://test/api/campaigns/audience/count", {
      method: "POST",
      body: raw ? (bodyOrRaw as string) : JSON.stringify(bodyOrRaw),
    }),
  )
}

beforeEach(() => {
  H.user = { id: "user-1" }
  H.orgId = "org-1"
  H.resolveMock.mockReset()
  H.resolveMock.mockResolvedValue([])
})

describe("POST /api/campaigns/audience/count", () => {
  test("unauthorized → 401", async () => {
    H.user = null
    const res = await post({ channel: "email", groupIds: ["g"] })
    expect(res.status).toBe(401)
  })

  test("missing org → 400", async () => {
    H.orgId = null
    const res = await post({ channel: "email", groupIds: ["g"] })
    expect(res.status).toBe(400)
  })

  test("invalid channel → 400", async () => {
    const res = await post({ channel: "carrier-pigeon", groupIds: ["g"] })
    expect(res.status).toBe(400)
    expect(H.resolveMock).not.toHaveBeenCalled()
  })

  test("invalid JSON → 400", async () => {
    const res = await post("{ not json", true)
    expect(res.status).toBe(400)
  })

  test("caps sampleIds at 3 even when the resolver returns hundreds", async () => {
    H.resolveMock.mockResolvedValue(Array.from({ length: 250 }, (_, i) => `id-${i}`))
    const res = await post({ channel: "email", groupIds: ["g"] })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(250)
    expect(body.sampleIds).toHaveLength(3)
    expect(body.sampleIds).toEqual(["id-0", "id-1", "id-2"])
  })

  test("both arrays empty → { count: 0, sampleIds: [] } and resolver not called", async () => {
    const res = await post({ channel: "sms", buyerIds: [], groupIds: [] })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ count: 0, sampleIds: [] })
    expect(H.resolveMock).not.toHaveBeenCalled()
  })

  test("resolver throws → 500 with a generic message (no raw leak)", async () => {
    H.resolveMock.mockRejectedValue(new Error("pg: connection refused at 10.0.0.5"))
    const res = await post({ channel: "email", groupIds: ["g"] })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Failed to resolve audience")
    expect(body.error).not.toContain("connection refused")
  })
})
