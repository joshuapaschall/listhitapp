// Setup hub outcomes are derived from real data — nothing a user can click
// "done" on. Covers each outcome, the pinned owner org, the dashboard banner,
// and the removed Gmail step.

const h = vi.hoisted(() => ({ db: null as any }))

vi.mock("@/lib/supabase", () => ({
  get supabaseAdmin() {
    return h.db.client
  },
}))

import { makeDb, type Row } from "./helpers/dns-route-mocks"
import { getSetupSummary } from "@/lib/onboarding/outcomes"
import { deriveSetupSummary, textingOutcome, type OutcomeData } from "@/lib/onboarding/outcome-types"
import { ONBOARDING_STEPS, getStepDef } from "@/lib/onboarding/steps"
import { canClientWriteStep } from "@/lib/onboarding/service"

const ORG = "11111111-1111-4111-8111-111111111111"
const PINNED = "22222222-2222-4222-8222-222222222222"

function tables(over: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    business_verification: [],
    organizations: [{ id: ORG, website_url: null }],
    a2p_registration: [],
    sites: [],
    site_domains: [],
    email_domains: [],
    email_senders: [],
    org_twilio: [],
    buyers: [],
    profiles: [{ id: "u1", full_name: "Josh Paschall" }],
    ...over,
  }
}

const byKey = (s: Awaited<ReturnType<typeof getSetupSummary>>, k: string) => s.outcomes.find((o) => o.key === k)!

beforeEach(() => {
  process.env.TELNYX_PINNED_ORG_IDS = PINNED
  h.db = makeDb(tables())
})

describe("outcomes from data", () => {
  test("a brand-new org: nothing ready, business recommended first, banner shown", async () => {
    const s = await getSetupSummary(ORG, "u1")
    expect(s.readyCount).toBe(0)
    expect(s.totalCount).toBe(4)
    expect(s.outcomes.map((o) => o.key)).toEqual(["business", "website", "texting", "email", "buyers"])
    expect(s.recommended).toBe("business")
    expect(s.banner).toBe("setup")
    expect(s.firstName).toBe("Josh")
    expect(byKey(s, "texting").status).toBe("Not started · get a local number for texts and calls")
  })

  test("business is ready only when business_verification.status = ready", async () => {
    h.db = makeDb(tables({ business_verification: [{ org_id: ORG, status: "draft", legal_business_name: "Acme LLC" }] }))
    expect(byKey(await getSetupSummary(ORG), "business").state).toBe("in_progress")
    h.db = makeDb(tables({ business_verification: [{ org_id: ORG, status: "ready" }] }))
    expect(byKey(await getSetupSummary(ORG), "business").ready).toBe(true)
  })

  test("website: a published site, or website + privacy + terms; a custom domain shows in the status", async () => {
    h.db = makeDb(
      tables({
        sites: [{ id: "s1", org_id: ORG, slug: "acme", status: "published" }],
        site_domains: [{ org_id: ORG, site_id: "s1", domain: "acmehomes.com", type: "custom", status: "active" }],
      }),
    )
    const s1 = await getSetupSummary(ORG)
    expect(byKey(s1, "website")).toMatchObject({ ready: true, status: "Live at acmehomes.com" })

    h.db = makeDb(
      tables({
        organizations: [{ id: ORG, website_url: "https://acmehomes.com" }],
        a2p_registration: [{ org_id: ORG, privacy_policy_url: "https://acmehomes.com/privacy", terms_url: null }],
      }),
    )
    expect(byKey(await getSetupSummary(ORG), "website").ready).toBe(false)
    h.db = makeDb(
      tables({
        organizations: [{ id: ORG, website_url: "https://acmehomes.com" }],
        a2p_registration: [{ org_id: ORG, privacy_policy_url: "https://acmehomes.com/privacy", terms_url: "https://acmehomes.com/terms" }],
      }),
    )
    expect(byKey(await getSetupSummary(ORG), "website")).toMatchObject({ ready: true, status: "Using acmehomes.com" })
  })

  test("email needs a verified domain AND a sender on it", async () => {
    h.db = makeDb(tables({ email_domains: [{ id: "d1", org_id: ORG, domain: "acme.com", status: "verified" }] }))
    expect(byKey(await getSetupSummary(ORG), "email")).toMatchObject({ ready: false, status: "Choose your from address" })
    h.db = makeDb(
      tables({
        email_domains: [{ id: "d1", org_id: ORG, domain: "acme.com", status: "verified" }],
        email_senders: [{ org_id: ORG, domain_id: "d1", from_email: "deals@acme.com", is_default: true }],
      }),
    )
    expect(byKey(await getSetupSummary(ORG), "email")).toMatchObject({ ready: true, status: "Sending from deals@acme.com" })
    h.db = makeDb(tables({ email_domains: [{ id: "d1", org_id: ORG, domain: "acme.com", status: "pending" }], email_senders: [] }))
    expect(byKey(await getSetupSummary(ORG), "email").status).toBe("Connecting acme.com")
  })

  test.each([
    ["not_started", "not_started", "Not started"],
    ["awaiting_approval", "in_review", "In review"],
    ["submitting", "in_review", "In review"],
    ["in_review", "in_review", "In review"],
    ["verify_mobile", "action_needed", "Action needed: reply YES"],
    ["action_required", "action_needed", "Action needed"],
    ["live", "ready", "Live"],
  ])("texting stage %s → %s (%s)", (stage, state, status) => {
    const o = textingOutcome(stage as any, "+15125550100", false)
    expect(o.state).toBe(state)
    expect(o.status.startsWith(status)).toBe(true)
  })

  test("buyers (optional) counts real buyers and never affects X of 4", async () => {
    h.db = makeDb(tables({ buyers: [{ id: "b1", org_id: ORG, deleted_at: null }, { id: "b2", org_id: ORG, deleted_at: null }] }))
    const s = await getSetupSummary(ORG)
    expect(byKey(s, "buyers")).toMatchObject({ ready: true, optional: true, status: "2 buyers in your list" })
    expect(s.readyCount).toBe(0)
  })
})

describe("banner and recommendation", () => {
  const base: OutcomeData = {
    pinned: false,
    firstName: null,
    business: { status: "ready", hasAnyDetails: true },
    website: { publishedSiteUrl: "https://acme.listhit.io", hasDraftSite: false, websiteUrl: null, privacyUrl: null, termsUrl: null, customDomain: null },
    email: { verifiedDomain: "acme.com", pendingDomain: null, fromAddress: "deals@acme.com" },
    texting: { stage: "in_review", phoneNumber: null },
    buyers: { count: 0 },
  }

  test("everything else ready and texting in review → slim texting banner", () => {
    const s = deriveSetupSummary(base)
    expect(s.banner).toBe("texting_review")
    expect(s.readyCount).toBe(3)
    expect(s.recommended).toBeNull()
  })

  test("all four ready → banner hidden", () => {
    expect(deriveSetupSummary({ ...base, texting: { stage: "live", phoneNumber: "+15125550100" } }).banner).toBe("hidden")
  })

  test("texting is recommended before email", () => {
    const s = deriveSetupSummary({ ...base, texting: { stage: "not_started", phoneNumber: null }, email: { verifiedDomain: null, pendingDomain: null, fromAddress: null } })
    expect(s.recommended).toBe("texting")
  })
})

describe("pinned owner org", () => {
  test("texting reads 'Live (owner phone system)' and the banner is hidden", async () => {
    h.db = makeDb(tables({ organizations: [{ id: PINNED, website_url: null }] }))
    const s = await getSetupSummary(PINNED)
    expect(s.pinned).toBe(true)
    expect(byKey(s, "texting")).toMatchObject({ ready: true, status: "Live (owner phone system)" })
    expect(s.banner).toBe("hidden")
  })
})

describe("legacy steps", () => {
  test("connect_gmail is gone", () => {
    expect(ONBOARDING_STEPS.map((s) => s.key)).not.toContain("connect_gmail")
    expect(getStepDef("connect_gmail")).toBeUndefined()
  })

  test("customers may only skip optional items", () => {
    expect(canClientWriteStep("import_buyers", "skipped")).toBe(true)
    expect(canClientWriteStep("import_buyers", "done")).toBe(false)
    expect(canClientWriteStep("verify_business", "skipped")).toBe(false)
    expect(canClientWriteStep("connect_gmail", "skipped")).toBe(false)
  })
})
