// Phase 2B resubmission: after the customer fixes their data, a failed brand
// gets up to 3 free resubmissions and a failed campaign is deleted so the next
// advance recreates it. Same in-memory row + fake Twilio client harness as
// org-twilio-engine.test.ts.

const h = vi.hoisted(() => {
  const ORG = "00000000-0000-4000-8000-0000000000aa"
  const state: any = {
    row: null as any,
    calls: [] as string[],
    args: {} as Record<string, any[]>,
    leaseBlocked: false,
    dbCalls: 0,
    data: null as any,
    brandStatus: "PENDING",
    identityStatus: "UNVERIFIED",
    brandErrors: [] as any[],
    campaignStatus: "IN_PROGRESS",
    campaignErrors: [] as any[],
    ownedNumbers: [] as any[],
    available: [{ phoneNumber: "+15125550100" }],
    desiredFails: false,
    campaignSeq: 0,
    inserts: [] as any[],
  }

  const copy = () => ({ ...state.row, provisioning_state: { ...(state.row?.provisioning_state ?? {}) } })

  const rec = (name: string, arg?: any) => {
    state.calls.push(name)
    ;(state.args[name] ||= []).push(arg)
  }

  const brand = () => ({
    sid: "BN1",
    status: state.brandStatus,
    identityStatus: state.identityStatus,
    errors: state.brandErrors,
    tcrId: "TCR1",
  })

  const fn = <T extends object>(call: (sid: string) => any, extra: T) => Object.assign(call, extra)

  const client: any = {
    events: {
      v1: {
        sinks: { create: async (a: any) => (rec("sinks.create", a), { sid: "DG1" }) },
        subscriptions: { create: async (a: any) => (rec("subscriptions.create", a), { sid: "DF1" }) },
      },
    },
    messaging: {
      v1: {
        services: fn(
          (mg: string) => ({
            phoneNumbers: { create: async (a: any) => (rec("services.phoneNumbers.create", { mg, ...a }), {}) },
            usAppToPerson: fn(
              (qe: string) => ({
                fetch: async () => (rec("usAppToPerson.fetch", qe), { campaignStatus: state.campaignStatus, errors: state.campaignErrors }),
                remove: async () => (rec("usAppToPerson.remove", qe), true),
              }),
              {
                create: async (a: any) => {
                  rec("usAppToPerson.create", a)
                  state.campaignSeq += 1
                  return { sid: `QE${state.campaignSeq}`, campaignStatus: "PENDING" }
                },
              },
            ),
          }),
          { create: async (a: any) => (rec("services.create", a), { sid: "MG1" }) },
        ),
        brandRegistrations: fn(
          (bn: string) => ({
            fetch: async () => (rec("brandRegistrations.fetch", bn), brand()),
            update: async () => (rec("brandRegistrations.update", bn), brand()),
            brandRegistrationOtps: { create: async () => (rec("brandRegistrationOtps.create", bn), {}) },
          }),
          { create: async (a: any) => (rec("brandRegistrations.create", a), brand()) },
        ),
      },
    },
    trusthub: {
      v1: {
        customerProfiles: fn(
          (sid: string) => ({
            customerProfilesEntityAssignments: { create: async (a: any) => (rec("customerProfiles.assign", a), {}) },
            customerProfilesEvaluations: {
              create: async (a: any) => (rec("customerProfiles.evaluate", a), { status: "compliant", results: [] }),
            },
            update: async (a: any) => (rec("customerProfiles.update", { sid, ...a }), { status: a.status }),
          }),
          { create: async (a: any) => (rec("customerProfiles.create", a), { sid: "BU" + "a".repeat(32), status: "draft" }) },
        ),
        endUsers: fn(
          (sid: string) => ({ update: async (a: any) => (rec("endUsers.update", { sid, ...a }), {}) }),
          { create: async (a: any) => (rec("endUsers.create", a), { sid: `IT-${a.type}` }) },
        ),
        supportingDocuments: { create: async (a: any) => (rec("supportingDocuments.create", a), { sid: "RD1" }) },
        trustProducts: fn(
          (sid: string) => ({
            trustProductsEntityAssignments: { create: async (a: any) => (rec("trustProducts.assign", a), {}) },
            trustProductsEvaluations: {
              create: async (a: any) => (rec("trustProducts.evaluate", a), { status: "compliant", results: [] }),
            },
            update: async (a: any) => (rec("trustProducts.update", { sid, ...a }), { status: a.status }),
          }),
          { create: async (a: any) => (rec("trustProducts.create", a), { sid: "BU" + "b".repeat(32), status: "draft" }) },
        ),
      },
    },
    addresses: fn(
      (sid: string) => ({ update: async (a: any) => (rec("addresses.update", { sid, ...a }), {}) }),
      { create: async (a: any) => (rec("addresses.create", a), { sid: "AD1" }) },
    ),
    incomingPhoneNumbers: {
      list: async (a: any) => (rec("incomingPhoneNumbers.list", a), state.ownedNumbers),
      create: async (a: any) => {
        rec("incomingPhoneNumbers.create", a)
        if (state.desiredFails && a.phoneNumber === state.row?.desired_phone_number) {
          throw Object.assign(new Error("not available"), { status: 400, code: 21422 })
        }
        const bought = { sid: `PN${state.calls.length}`, phoneNumber: a.phoneNumber, accountSid: "ACsub" }
        state.ownedNumbers = [bought]
        return bought
      },
    },
    availablePhoneNumbers: (_country: string) => ({
      local: { list: async (a: any) => (rec("availablePhoneNumbers.list", a), state.available) },
    }),
  }

  // Thin supabaseAdmin: the lease, markets, inbound_numbers, a2p_registration.
  const supabaseAdmin: any = {
    from: (table: string) => {
      state.dbCalls += 1
      if (table === "org_twilio") {
        return {
          update: (patch: any) => {
            const b: any = {
              _or: false,
              eq: () => b,
              or: () => ((b._or = true), b),
              select: async () => {
                if (state.leaseBlocked || !state.row) return { data: [], error: null }
                Object.assign(state.row, patch)
                return { data: [copy()], error: null }
              },
              then: (res: any, rej: any) => {
                if (state.row) Object.assign(state.row, patch)
                return Promise.resolve({ error: null }).then(res, rej)
              },
            }
            return b
          },
        }
      }
      if (table === "markets") {
        const b: any = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: { id: "MK1" }, error: null }) }
        return b
      }
      if (table === "inbound_numbers") {
        return { insert: async (row: any) => (state.inserts.push(row), { error: null }) }
      }
      if (table === "a2p_registration") {
        return { update: (p: any) => ({ eq: async () => (rec("a2p_registration.update", p), { error: null }) }) }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }

  const service = {
    getOrgTwilio: vi.fn(async () => (state.row ? copy() : null)),
    upsertOrgTwilio: vi.fn(async (_org: string, patch: any) => {
      Object.assign(state.row, patch)
      return copy()
    }),
    mergeProvisioningState: vi.fn(async (_org: string, partial: any, patch?: any) => {
      state.row.provisioning_state = { ...(state.row.provisioning_state ?? {}), ...partial }
      if (patch) Object.assign(state.row, patch)
      return copy()
    }),
  }

  const notify = {
    notifyLive: vi.fn(async () => {}),
    notifyActionRequired: vi.fn(async () => {}),
    notifyPlatformAdminsAwaitingApproval: vi.fn(async () => {}),
  }

  const getTwilioClientForOrg = vi.fn(async () => client)

  return { ORG, state, client, supabaseAdmin, service, notify, getTwilioClientForOrg }
})

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: h.supabaseAdmin }))
vi.mock("@/lib/org-twilio/service", () => h.service)
vi.mock("@/lib/org-twilio/notify", () => h.notify)
vi.mock("@/lib/twilio/org-client", () => ({ getTwilioClientForOrg: h.getTwilioClientForOrg }))
vi.mock("@/lib/twilio/subaccounts", () => ({
  ensureOrgSubaccount: vi.fn(async () => ({ subaccountSid: "ACsub" })),
  ensureOrgVoiceCredentials: vi.fn(async () => ({ apiKeySid: "SK1", twimlAppSid: "AP1" })),
}))
vi.mock("@/lib/providers/twilio/client", () => ({ getListHitPrimaryProfileSid: () => "BUprimary" }))
vi.mock("@/lib/org-twilio/compliance-urls", () => ({
  resolveComplianceUrls: vi.fn(async () => ({
    websiteUrl: "https://acme.listhit.io",
    privacyUrl: "https://acme.listhit.io/privacy",
    termsUrl: "https://acme.listhit.io/terms",
    hasListHitSite: true,
  })),
}))
vi.mock("@/lib/org-twilio/inputs", async () => {
  const actual = await vi.importActual<any>("@/lib/org-twilio/inputs")
  return { ...actual, loadRegistrationData: vi.fn(async () => h.state.data) }
})

import { resubmitRegistration } from "@/lib/org-twilio/engine"
import { RESUBMISSIONS_EXHAUSTED_MESSAGE } from "@/lib/org-twilio/issues"

const { ORG, state, notify } = h

const SAMPLES = {
  sample_message_1: "Acme Homes: new 3/2 deal in Austin at $210k. Reply STOP to opt out.",
  sample_message_2: "Acme Homes: price drop on the Elm St flip, now $185k. Reply STOP to opt out.",
}

function standardData() {
  return {
    bv: {
      legal_business_name: "Acme Homes LLC",
      ein: "123456789",
      business_type: "LLC",
      contact_first_name: "Jane",
      contact_last_name: "Doe",
      contact_email: "jane@acmehomes.com",
      rep_phone: "+15125550123",
    },
    org: {
      name: "Acme",
      business_name: "Acme Homes",
      phone: "5125550123",
      address_line1: "1 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      website_url: "https://acmehomes.com",
    },
    a2p: { campaign_description: "Acme Homes texts real estate deals to investors who opted in on our website.", ...SAMPLES },
  }
}

function soleData() {
  const d = standardData()
  d.bv.ein = ""
  d.bv.business_type = ""
  return d
}

function baseRow(over: Record<string, any> = {}) {
  return {
    org_id: ORG,
    setup_stage: "submitting",
    brand_type: "STANDARD",
    submitted_at: "2026-10-14T00:00:00Z",
    spend_approved_at: null,
    mock_registration: false,
    desired_phone_number: null,
    desired_area_code: "512",
    messaging_service_sid: null,
    phone_number: null,
    brand_sid: null,
    brand_status: null,
    campaign_sid: null,
    campaign_status: null,
    campaign_errors: null,
    brand_update_count: 0,
    event_sink_sid: null,
    event_subscription_sid: null,
    live_at: null,
    live_notified_at: null,
    provisioning_state: {},
    ...over,
  }
}

const count = (name: string) => state.calls.filter((c: string) => c === name).length

beforeEach(() => {
  process.env.TWILIO_REGISTRATION_MIN_INTERVAL_MS = "0"
  process.env.TELNYX_PINNED_ORG_IDS = "00000000-0000-4000-8000-0000000000ff"
  process.env.NEXT_PUBLIC_BASE_URL = "https://app.listhit.io"
  process.env.LISTHIT_SECRETS_KEY = Buffer.alloc(32, 7).toString("base64")
  Object.assign(state, {
    row: baseRow(),
    calls: [],
    args: {},
    leaseBlocked: false,
    dbCalls: 0,
    data: standardData(),
    brandStatus: "PENDING",
    identityStatus: "UNVERIFIED",
    brandErrors: [],
    campaignStatus: "IN_PROGRESS",
    campaignErrors: [],
    ownedNumbers: [],
    available: [{ phoneNumber: "+15125550100" }],
    desiredFails: false,
    campaignSeq: 0,
    inserts: [],
  })
  notify.notifyLive.mockClear()
  notify.notifyActionRequired.mockClear()
  notify.notifyPlatformAdminsAwaitingApproval.mockClear()
  h.getTwilioClientForOrg.mockClear()
})

// A registration that already went through: drafts built and submitted, a
// number owned, Event Streams and the Messaging Service in place.
function submittedState(extra: Record<string, any> = {}) {
  return {
    secondary_profile_sid: "BU" + "a".repeat(32),
    business_info_enduser_sid: "IT-biz",
    business_info_attached: true,
    authorized_rep_enduser_sid: "IT-rep",
    authorized_rep_attached: true,
    address_sid: "AD1",
    supporting_document_sid: "RD1",
    supporting_document_attached: true,
    primary_profile_assigned: true,
    trust_product_sid: "BU" + "b".repeat(32),
    a2p_profile_enduser_sid: "IT-a2p",
    a2p_profile_attached: true,
    customer_profile_attached_to_trust_product: true,
    trust_hub_submitted_at: "2026-10-14T02:00:00Z",
    tcr_id: "TCR1",
    ...extra,
  }
}

function failedRow(over: Record<string, any> = {}) {
  return baseRow({
    setup_stage: "action_required",
    spend_approved_at: "2026-10-14T01:00:00Z",
    messaging_service_sid: "MG1",
    phone_number: "+15125550100",
    event_sink_sid: "DG1",
    event_subscription_sid: "DF1",
    brand_sid: "BN1",
    provisioning_state: submittedState(),
    ...over,
  })
}

describe("resubmitRegistration", () => {
  test("failed brand with a TCR id and < 3 updates → brand update called, count increments", async () => {
    state.row = failedRow({ brand_status: "FAILED", brand_update_count: 1 })
    state.brandStatus = "PENDING"

    const res = await resubmitRegistration(ORG)

    expect(count("brandRegistrations.update")).toBe(1)
    expect(state.args["brandRegistrations.update"][0]).toBe("BN1")
    expect(state.row.brand_update_count).toBe(2)
    // Corrected data was pushed and the bundles went back to review first.
    expect(count("endUsers.update")).toBeGreaterThan(0)
    expect(state.calls.indexOf("customerProfiles.update")).toBeLessThan(state.calls.indexOf("brandRegistrations.update"))
    expect(state.calls.indexOf("trustProducts.update")).toBeLessThan(state.calls.indexOf("brandRegistrations.update"))
    // The follow-up advance re-reads the brand instead of filing a new one.
    expect(count("brandRegistrations.create")).toBe(0)
    expect(res.stage).toBe("in_review")
  })

  test("3 updates used → no Twilio call at all, and the support issue", async () => {
    state.row = failedRow({ brand_status: "FAILED", brand_update_count: 3 })

    const res = await resubmitRegistration(ORG)

    expect(res.stage).toBe("action_required")
    expect(state.row.setup_stage).toBe("action_required")

    expect(state.calls).toEqual([])
    expect(h.getTwilioClientForOrg).not.toHaveBeenCalled()
    expect(state.row.customer_issues).toEqual([
      expect.objectContaining({ message: RESUBMISSIONS_EXHAUSTED_MESSAGE, fixable: false }),
    ])
    expect(state.row.brand_update_count).toBe(3)
  })

  test("failed campaign with fixable issues → deleted, cleared, and recreated by the next advance", async () => {
    state.row = failedRow({
      brand_status: "APPROVED",
      campaign_sid: "QE-old",
      campaign_status: "FAILED",
      campaign_errors: [{ error_code: 30893, description: "Samples need the brand name." }],
    })
    state.brandStatus = "APPROVED"
    state.campaignStatus = "IN_PROGRESS"

    const res = await resubmitRegistration(ORG)

    expect(state.args["usAppToPerson.remove"]).toEqual(["QE-old"])
    const removeAt = state.calls.indexOf("usAppToPerson.remove")
    const createAt = state.calls.indexOf("usAppToPerson.create")
    expect(createAt).toBeGreaterThan(removeAt)
    expect(count("usAppToPerson.create")).toBe(1)
    expect(state.row.campaign_sid).toBe("QE1")
    expect(state.row.campaign_status).toBe("IN_PROGRESS")
    expect(count("brandRegistrations.update")).toBe(0)
    expect(res.stage).toBe("in_review")
  })

  test("failed campaign with a carrier decline (not fixable) is never deleted", async () => {
    state.row = failedRow({
      brand_status: "APPROVED",
      campaign_sid: "QE-old",
      campaign_status: "FAILED",
      campaign_errors: [{ error_code: 30883, description: "Declined." }],
    })
    state.brandStatus = "APPROVED"
    state.campaignStatus = "FAILED"
    state.campaignErrors = [{ error_code: 30883, description: "Declined." }]

    await resubmitRegistration(ORG)

    expect(count("usAppToPerson.remove")).toBe(0)
    expect(count("usAppToPerson.create")).toBe(0)
  })
})
