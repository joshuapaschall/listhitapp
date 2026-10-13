// POST /api/org-twilio/submit — validates everything before any Twilio work,
// records the request once, hands off to the engine, and never leaks SIDs.

const ORG = "33333333-3333-4333-8333-333333333333"
const PINNED = "adddfd02-790e-4be7-a0df-047b7dbdd1b8"

const h = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  orgId: "33333333-3333-4333-8333-333333333333" as string | null,
  role: "owner",
  bvUpdates: [] as Array<Record<string, unknown>>,
  data: null as any,
  urls: null as any,
  row: null as any,
  upsert: vi.fn(),
  advance: vi.fn(),
}))

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({ user: h.user, orgId: h.orgId }),
}))
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "profiles") {
        const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { role: h.role }, error: null }) }
        return q
      }
      if (table === "business_verification") {
        return {
          update: (patch: Record<string, unknown>) => {
            h.bvUpdates.push(patch)
            return { eq: async () => ({ error: null }) }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  },
}))
vi.mock("@/lib/org-twilio/service", () => ({
  getOrgTwilio: async () => h.row,
  upsertOrgTwilio: h.upsert,
}))
vi.mock("@/lib/org-twilio/engine", () => ({ advanceRegistration: h.advance }))
vi.mock("@/lib/org-twilio/compliance-urls", () => ({ resolveComplianceUrls: async () => h.urls }))
vi.mock("@/lib/org-twilio/inputs", async () => {
  const actual = await vi.importActual<any>("@/lib/org-twilio/inputs")
  return { ...actual, loadRegistrationData: async () => h.data }
})

import { POST } from "../app/api/org-twilio/submit/route"
import { PINNED_ORG_MESSAGE } from "../app/api/org-twilio/_shared"

const req = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/org-twilio/submit", { method: "POST", body: JSON.stringify(body) })

const standardData = () => ({
  bv: {
    legal_business_name: "Acme Holdings LLC",
    ein: "423209251",
    business_type: "Limited Liability Corporation",
    contact_first_name: "Jane",
    contact_last_name: "Doe",
    contact_email: "jane@acme.com",
    rep_phone: "+15125559999",
  },
  org: { phone: "5125550123", address_line1: "1 Main St", city: "Austin", state: "TX", zip: "78701", website_url: "https://acme.com" },
  a2p: {},
})

const liveRow = () => ({
  org_id: ORG,
  setup_stage: "awaiting_approval",
  brand_type: "STANDARD",
  submitted_at: "2026-10-14T00:00:00Z",
  subaccount_sid: "AC" + "1".repeat(32),
  messaging_service_sid: "MG" + "1".repeat(32),
  brand_sid: "BN" + "1".repeat(32),
  phone_number: "+15125550100",
  provisioning_state: { trust_hub_submitted_at: "2026-10-14T00:00:00Z" },
  customer_issues: null,
})

const body = { brandType: "STANDARD", repPhone: "512-555-9999", repTitle: "Owner", repJobPosition: "CEO" }

describe("POST /api/org-twilio/submit", () => {
  beforeEach(() => {
    process.env.TELNYX_PINNED_ORG_IDS = PINNED
    h.user = { id: "user-1" }
    h.orgId = ORG
    h.role = "owner"
    h.bvUpdates = []
    h.data = standardData()
    h.urls = { websiteUrl: "https://acme.com", privacyUrl: "https://acme.listhit.io/privacy", termsUrl: "https://acme.listhit.io/terms", hasListHitSite: true }
    h.row = null
    h.upsert.mockReset().mockImplementation(async (_org: string, patch: Record<string, unknown>) => {
      h.row = { ...liveRow(), ...patch }
      return h.row
    })
    // The real engine moves an unapproved org to awaiting_approval.
    h.advance.mockReset().mockImplementation(async () => {
      if (h.row) h.row = { ...h.row, setup_stage: "awaiting_approval" }
      return { stage: "awaiting_approval", changed: true }
    })
  })

  test("a member who isn't owner/admin → 403", async () => {
    h.role = "user"
    const res = await POST(req(body))
    expect(res.status).toBe(403)
    expect(h.advance).not.toHaveBeenCalled()
  })

  test("the pinned owner org → 403 with the owner-phone-system message", async () => {
    h.orgId = PINNED
    const res = await POST(req(body))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe(PINNED_ORG_MESSAGE)
    expect(h.advance).not.toHaveBeenCalled()
  })

  test("STANDARD without an EIN → 422 with an ein issue", async () => {
    h.data.bv.ein = null
    const res = await POST(req(body))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.issues.some((i: any) => i.field === "ein")).toBe(true)
    expect(h.advance).not.toHaveBeenCalled()
    expect(h.upsert).not.toHaveBeenCalled()
  })

  test("SOLE_PROPRIETOR with an EIN → 422 with an ein issue", async () => {
    const res = await POST(req({ ...body, brandType: "SOLE_PROPRIETOR" }))
    expect(res.status).toBe(422)
    expect((await res.json()).issues.some((i: any) => i.field === "ein")).toBe(true)
    expect(h.advance).not.toHaveBeenCalled()
  })

  test("needs_website → 422 with a website issue", async () => {
    h.urls = { error: "needs_website" }
    const res = await POST(req(body))
    expect(res.status).toBe(422)
    expect((await res.json()).issues).toEqual([expect.objectContaining({ field: "website", fixable: true })])
    expect(h.advance).not.toHaveBeenCalled()
  })

  test("an invalid rep phone → 422 before anything is saved", async () => {
    const res = await POST(req({ ...body, repPhone: "12" }))
    expect(res.status).toBe(422)
    expect(h.bvUpdates).toHaveLength(0)
  })

  test("an unknown business type → 422", async () => {
    const res = await POST(req({ ...body, businessType: "sole trader" }))
    expect(res.status).toBe(422)
    expect((await res.json()).issues[0].field).toBe("business_type")
  })

  test("a bad brandType → 400", async () => {
    const res = await POST(req({ ...body, brandType: "BOGUS" }))
    expect(res.status).toBe(400)
  })

  test("success saves rep fields, records the request, calls the engine, and returns status without SIDs", async () => {
    const res = await POST(req({ ...body, desiredPhoneNumber: "(512) 555-0100", areaCode: "512" }))
    expect(res.status).toBe(200)

    expect(h.bvUpdates[0]).toMatchObject({ rep_phone: "+15125559999", rep_title: "Owner", rep_job_position: "CEO" })
    expect(h.upsert).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({
        brand_type: "STANDARD",
        desired_phone_number: "+15125550100",
        desired_area_code: "512",
        submitted_at: expect.any(String),
      }),
    )
    expect(h.advance).toHaveBeenCalledWith(ORG, { reason: "submit" })

    const json = await res.json()
    expect(json).toMatchObject({ stage: "awaiting_approval", brandType: "STANDARD", reviewCopy: "Usually a few business days" })
    const text = JSON.stringify(json)
    expect(text.toLowerCase()).not.toContain("sid")
    expect(text).not.toMatch(/"(AC|BN|MG)[0-9a-f]{32}"/i)
  })

  test("a second submit once submitted returns status and changes nothing", async () => {
    h.row = liveRow()
    const res = await POST(req(body))
    expect(res.status).toBe(200)
    expect(h.advance).not.toHaveBeenCalled()
    expect(h.upsert).not.toHaveBeenCalled()
    expect(h.bvUpdates).toHaveLength(0)
    expect((await res.json()).stage).toBe("awaiting_approval")
  })
})
