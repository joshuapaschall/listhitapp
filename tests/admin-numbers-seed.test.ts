// /api/admin/numbers/seed: platform-admin + bearer gated, insert-only. A number
// owned by another org rejects the whole request; nothing is ever reassigned.

const h = vi.hoisted(() => {
  const state = {
    user: { id: "admin-1" } as { id: string } | null,
    orgId: "org-a" as string | null,
    rows: [] as Array<{ e164: string; org_id: string; provider?: string }>,
    inserts: [] as any[],
    upserts: 0,
    updates: 0,
  }
  const admin = {
    from: (table: string) => {
      if (table !== "inbound_numbers") throw new Error(`Unexpected table ${table}`)
      let filter: string[] | null = null
      const q: any = {
        select: () => q,
        in: (_c: string, vals: string[]) => ((filter = vals), q),
        then: (resolve: any) =>
          resolve({ data: state.rows.filter((r) => !filter || filter.includes(r.e164)), error: null }),
        insert: (rows: any[]) => {
          state.inserts.push(...rows)
          return { select: async () => ({ data: rows, error: null }) }
        },
        upsert: () => {
          state.upserts++
          throw new Error("upsert must never be used")
        },
        update: () => {
          state.updates++
          throw new Error("update must never be used")
        },
      }
      return q
    },
  }
  return { state, admin }
})

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.admin }))
vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: h.state.user, orgId: h.state.orgId, supabase: {} }),
}))

import { POST } from "../app/api/admin/numbers/seed/route"

const req = (body: any, token = "seed-token") =>
  new Request("http://test/api/admin/numbers/seed", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  })

describe("admin numbers seed", () => {
  beforeEach(() => {
    process.env.PLATFORM_ADMIN_USER_IDS = "admin-1"
    process.env.ADMIN_TASKS_TOKEN = "seed-token"
    h.state.user = { id: "admin-1" }
    h.state.orgId = "org-a"
    h.state.rows = []
    h.state.inserts = []
    h.state.upserts = 0
    h.state.updates = 0
  })

  test("non-platform-admin → 403 even with the bearer token", async () => {
    h.state.user = { id: "tenant-owner" }
    const res = await POST(req({ rows: [{ e164: "+14705550100", provider: "twilio" }] }))
    expect(res.status).toBe(403)
    expect(h.state.inserts).toHaveLength(0)
  })

  test("platform admin without the bearer token → 401", async () => {
    const res = await POST(req({ rows: [{ e164: "+14705550100", provider: "twilio" }] }, "wrong"))
    expect(res.status).toBe(401)
    expect(h.state.inserts).toHaveLength(0)
  })

  test("an e164 owned by another org → 409 and nothing is written", async () => {
    h.state.rows = [{ e164: "+14705550100", org_id: "org-b", provider: "telnyx" }]
    const res = await POST(
      req({ rows: [{ e164: "+14705550101", provider: "twilio" }, { e164: "+14705550100", provider: "twilio" }] }),
    )
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "number_owned_by_another_org" })
    expect(h.state.inserts).toHaveLength(0)
    expect(h.state.upserts).toBe(0)
    expect(h.state.updates).toBe(0)
    // Never reassigned.
    expect(h.state.rows[0].org_id).toBe("org-b")
  })

  test("a row without a provider → 400", async () => {
    const res = await POST(req({ rows: [{ e164: "+14705550100" }] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "provider_required" })
    expect(h.state.inserts).toHaveLength(0)
  })

  test("an invalid provider → 400", async () => {
    const res = await POST(req({ rows: [{ e164: "+14705550100", provider: "bandwidth" }] }))
    expect(res.status).toBe(400)
  })

  test("happy path inserts new numbers for the caller's org with their provider", async () => {
    const res = await POST(
      req({ rows: [{ e164: "4705550100", provider: "twilio", label: "Main" }, { e164: "+14705550199", provider: "telnyx" }] }),
    )
    expect(res.status).toBe(200)
    expect(h.state.inserts).toEqual([
      { e164: "+14705550100", org_id: "org-a", label: "Main", provider: "twilio" },
      { e164: "+14705550199", org_id: "org-a", label: null, provider: "telnyx" },
    ])
    expect(h.state.upserts).toBe(0)
  })

  test("numbers the org already owns are skipped, not rewritten", async () => {
    h.state.rows = [{ e164: "+14705550100", org_id: "org-a", provider: "twilio" }]
    const res = await POST(
      req({ rows: [{ e164: "+14705550100", provider: "telnyx" }, { e164: "+14705550101", provider: "twilio" }] }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.skipped).toEqual(["+14705550100"])
    expect(h.state.inserts).toEqual([{ e164: "+14705550101", org_id: "org-a", label: null, provider: "twilio" }])
    expect(h.state.updates).toBe(0)
    expect(h.state.rows[0].provider).toBe("twilio")
  })
})
