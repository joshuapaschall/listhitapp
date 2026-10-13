// Platform-admin registration routes: queue, approve, mock, advance.

const ORG = "66666666-6666-4666-8666-666666666666"
const ADMIN = "admin-user"

const h = vi.hoisted(() => ({
  user: { id: "admin-user" } as { id: string } | null,
  row: null as any,
  upsert: vi.fn(),
  advance: vi.fn(),
  queueRows: [] as any[],
  queueOr: "" as string,
}))

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: h.user, orgId: "some-org" }),
}))
vi.mock("@/lib/org-twilio/service", () => ({
  getOrgTwilio: async () => h.row,
  upsertOrgTwilio: h.upsert,
}))
vi.mock("@/lib/org-twilio/engine", () => ({ advanceRegistration: h.advance }))
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: () => {
      const q: any = {
        select: () => q,
        or: (f: string) => {
          h.queueOr = f
          return q
        },
        order: async () => ({ data: h.queueRows, error: null }),
      }
      return q
    },
  },
}))

import { GET as queue } from "../app/api/admin/org-twilio/queue/route"
import { POST as approve } from "../app/api/admin/org-twilio/approve/route"
import { POST as mock } from "../app/api/admin/org-twilio/mock/route"
import { POST as advance } from "../app/api/admin/org-twilio/advance/route"

const req = (body: unknown) => new Request("http://localhost/api/admin/org-twilio/x", { method: "POST", body: JSON.stringify(body) })

describe("admin org-twilio routes", () => {
  beforeEach(() => {
    process.env.PLATFORM_ADMIN_USER_IDS = ADMIN
    h.user = { id: ADMIN }
    h.row = { org_id: ORG, setup_stage: "awaiting_approval", spend_approved_at: null, brand_sid: null, provisioning_state: {} }
    h.upsert.mockReset().mockImplementation(async (_o: string, patch: any) => {
      h.row = { ...h.row, ...patch }
      return h.row
    })
    h.advance.mockReset().mockResolvedValue({ stage: "submitting", changed: true })
    h.queueRows = []
    h.queueOr = ""
  })

  describe("non-platform-admin → 403 on all four", () => {
    beforeEach(() => {
      h.user = { id: "regular-owner" }
    })
    test("queue", async () => expect((await queue()).status).toBe(403))
    test("approve", async () => {
      expect((await approve(req({ orgId: ORG }))).status).toBe(403)
      expect(h.upsert).not.toHaveBeenCalled()
      expect(h.advance).not.toHaveBeenCalled()
    })
    test("mock", async () => {
      expect((await mock(req({ orgId: ORG, mock: true }))).status).toBe(403)
      expect(h.upsert).not.toHaveBeenCalled()
    })
    test("advance", async () => {
      expect((await advance(req({ orgId: ORG }))).status).toBe(403)
      expect(h.advance).not.toHaveBeenCalled()
    })
  })

  test("no user → 401", async () => {
    h.user = null
    expect((await queue()).status).toBe(401)
  })

  test("approve sets spend_approved_at + spend_approved_by and advances with reason approved", async () => {
    const res = await approve(req({ orgId: ORG }))
    expect(res.status).toBe(200)
    expect(h.upsert).toHaveBeenCalledWith(ORG, {
      spend_approved_at: expect.any(String),
      spend_approved_by: ADMIN,
    })
    expect(h.advance).toHaveBeenCalledWith(ORG, { reason: "approved" })
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.status.stage).toBeDefined()
  })

  test("approve is idempotent: an already-approved org isn't re-stamped", async () => {
    h.row.spend_approved_at = "2026-10-01T00:00:00Z"
    await approve(req({ orgId: ORG }))
    expect(h.upsert).not.toHaveBeenCalled()
    expect(h.advance).toHaveBeenCalledWith(ORG, { reason: "approved" })
  })

  test("approve with a bad orgId → 400", async () => {
    expect((await approve(req({ orgId: "nope" }))).status).toBe(400)
  })

  test("mock toggle before a brand exists → saved", async () => {
    const res = await mock(req({ orgId: ORG, mock: true }))
    expect(res.status).toBe(200)
    expect(h.upsert).toHaveBeenCalledWith(ORG, { mock_registration: true })
  })

  test("mock toggle after a brand exists → 409, unchanged", async () => {
    h.row.brand_sid = "BN" + "1".repeat(32)
    const res = await mock(req({ orgId: ORG, mock: false }))
    expect(res.status).toBe(409)
    expect(h.upsert).not.toHaveBeenCalled()
  })

  test("mock without a boolean → 400", async () => {
    expect((await mock(req({ orgId: ORG, mock: "yes" }))).status).toBe(400)
  })

  test("advance nudges the engine with reason admin", async () => {
    const res = await advance(req({ orgId: ORG }))
    expect(res.status).toBe(200)
    expect(h.advance).toHaveBeenCalledWith(ORG, { reason: "admin" })
  })

  test("queue lists awaiting/action/rejected plus long in-review orgs", async () => {
    h.queueRows = [
      {
        org_id: ORG,
        setup_stage: "awaiting_approval",
        brand_type: "STANDARD",
        submitted_at: "2026-10-01T00:00:00Z",
        customer_issues: null,
        organizations: { name: "Acme" },
      },
    ]
    const res = await queue()
    expect(res.status).toBe(200)
    expect(h.queueOr).toContain("setup_stage.in.(awaiting_approval,action_required,rejected)")
    expect(h.queueOr).toContain("setup_stage.eq.in_review")
    expect((await res.json()).items).toEqual([
      { orgId: ORG, orgName: "Acme", stage: "awaiting_approval", brandType: "STANDARD", submittedAt: "2026-10-01T00:00:00Z", issues: [] },
    ])
  })
})
