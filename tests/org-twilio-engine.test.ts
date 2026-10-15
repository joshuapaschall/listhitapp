// Phase 2B registration engine. The org_twilio row lives in memory behind a
// mocked service layer; Twilio is a fake client that records every call in
// order, so the tests can assert the ISV sequence, the spend gate and the
// per-stage outcomes without any network.

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
    tpEval: { status: "compliant", results: [] } as any,
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
              create: async (a: any) => (rec("trustProducts.evaluate", a), state.tpEval),
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

import { advanceRegistration } from "@/lib/org-twilio/engine"

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

const idx = (name: string) => state.calls.indexOf(name)
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
    tpEval: { status: "compliant", results: [] },
  })
  notify.notifyLive.mockClear()
  notify.notifyActionRequired.mockClear()
  notify.notifyPlatformAdminsAwaitingApproval.mockClear()
  h.getTwilioClientForOrg.mockClear()
})

describe("advanceRegistration — guards", () => {
  test("not submitted → not_started, no Twilio calls", async () => {
    state.row = baseRow({ submitted_at: null, setup_stage: "not_started" })
    const res = await advanceRegistration(ORG, { reason: "test" })
    expect(res.stage).toBe("not_started")
    expect(state.calls).toEqual([])
    expect(h.getTwilioClientForOrg).not.toHaveBeenCalled()
  })

  test("pinned org returns immediately — no DB, no Twilio", async () => {
    const pinned = "00000000-0000-4000-8000-0000000000ff"
    const res = await advanceRegistration(pinned, { reason: "test" })
    expect(res).toEqual({ stage: "not_started", changed: false })
    expect(state.dbCalls).toBe(0)
    expect(h.service.getOrgTwilio).not.toHaveBeenCalledWith(pinned)
    expect(state.calls).toEqual([])
  })

  test("lease held by another run → returns without any Twilio call", async () => {
    state.leaseBlocked = true
    state.row = baseRow({ spend_approved_at: "2026-10-14T01:00:00Z", setup_stage: "in_review" })
    const res = await advanceRegistration(ORG, { reason: "concurrent" })
    expect(res).toEqual({ stage: "in_review", changed: false })
    expect(state.calls).toEqual([])
    expect(h.getTwilioClientForOrg).not.toHaveBeenCalled()
  })
})

describe("advanceRegistration — spend gate", () => {
  test("submitted, not approved → free resources only, awaiting_approval, admins notified once", async () => {
    const first = await advanceRegistration(ORG, { reason: "submit" })
    expect(first.stage).toBe("awaiting_approval")
    expect(state.row.setup_stage).toBe("awaiting_approval")

    // Free: Messaging Service + Trust Hub drafts submitted for review (+ Event Streams).
    expect(count("services.create")).toBe(1)
    expect(count("customerProfiles.create")).toBe(1)
    expect(count("trustProducts.create")).toBe(1)
    expect(count("sinks.create")).toBe(1)
    // Twilio's ISV order: the profile is in review before the TrustProduct is built.
    const order = [
      "customerProfiles.create",
      "customerProfiles.evaluate",
      "customerProfiles.update",
      "trustProducts.create",
      "trustProducts.evaluate",
      "trustProducts.update",
    ].map(idx)
    order.forEach((i) => expect(i).toBeGreaterThanOrEqual(0))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(state.args["customerProfiles.update"][0]).toMatchObject({ status: "pending-review" })
    expect(state.args["trustProducts.update"][0]).toMatchObject({ status: "pending-review" })
    expect(state.row.provisioning_state.trust_hub_submitted_at).toBeTruthy()
    expect(state.row.customer_profile_status).toBe("pending-review")
    // Nothing that costs money.
    expect(count("incomingPhoneNumbers.create")).toBe(0)
    expect(count("brandRegistrations.create")).toBe(0)
    expect(count("usAppToPerson.create")).toBe(0)

    const second = await advanceRegistration(ORG, { reason: "cron" })
    expect(second.stage).toBe("awaiting_approval")
    expect(notify.notifyPlatformAdminsAwaitingApproval).toHaveBeenCalledTimes(1)
    expect(count("incomingPhoneNumbers.create")).toBe(0)
    expect(count("brandRegistrations.create")).toBe(0)
    // Already submitted: no second submit.
    expect(count("customerProfiles.update")).toBe(1)
    expect(count("trustProducts.update")).toBe(1)
  })

  test("profile already in-review on a re-run → no second profile submit, TrustProduct still submitted", async () => {
    state.row = baseRow({
      customer_profile_status: "in-review",
      provisioning_state: {
        secondary_profile_sid: "BU" + "a".repeat(32),
        business_info_enduser_sid: "IT-biz",
        business_info_attached: true,
        authorized_rep_enduser_sid: "IT-rep",
        authorized_rep_attached: true,
        address_sid: "AD1",
        supporting_document_sid: "RD1",
        supporting_document_attached: true,
        primary_profile_assigned: true,
        submitted: true,
      },
    })
    const res = await advanceRegistration(ORG, { reason: "cron" })

    expect(res.stage).toBe("awaiting_approval")
    expect(count("customerProfiles.update")).toBe(0)
    // Not re-synced either: editing a profile in review sends it back to draft.
    expect(count("endUsers.update")).toBe(0)
    expect(count("trustProducts.create")).toBe(1)
    expect(count("trustProducts.update")).toBe(1)
    expect(state.row.provisioning_state.trust_hub_submitted_at).toBeTruthy()
  })

  test("TrustProduct evaluation fails only on Twilio sequencing → retried, not action_required, no email", async () => {
    state.tpEval = {
      status: "noncompliant",
      results: [
        {
          friendly_name: "Secondary Customer Profile",
          passed: false,
          fields: [
            { object_field: "status", passed: false, failure_reason: "Secondary Customer Profile registration Proof" },
            {
              object_field: "status",
              passed: false,
              failure_reason: "The status of the Secondary Customer Profile must be in atleast review state",
            },
          ],
        },
      ],
    }
    const before = Date.now()
    const res = await advanceRegistration(ORG, { reason: "submit" })

    expect(res.stage).not.toBe("action_required")
    expect(state.row.setup_stage).toBe("submitting")
    expect(state.row.customer_issues ?? null).toBeNull()
    const next = Date.parse(state.row.next_check_at)
    expect(next - before).toBeGreaterThanOrEqual(4.5 * 60_000)
    expect(next - before).toBeLessThanOrEqual(5.5 * 60_000)
    expect(notify.notifyActionRequired).not.toHaveBeenCalled()
    expect(count("trustProducts.update")).toBe(0)
    expect(state.row.provisioning_state.trust_hub_submitted_at).toBeUndefined()
    expect(count("incomingPhoneNumbers.create")).toBe(0)
  })
})

describe("advanceRegistration — Standard path", () => {
  test("approved: submit profile → submit TrustProduct → buy number → add to service → brand; no campaign while PENDING", async () => {
    state.row = baseRow({ spend_approved_at: "2026-10-14T01:00:00Z" })
    const res = await advanceRegistration(ORG, { reason: "approved" })

    expect(res.stage).toBe("in_review")
    const order = [
      "customerProfiles.update",
      "trustProducts.update",
      "incomingPhoneNumbers.create",
      "services.phoneNumbers.create",
      "brandRegistrations.create",
    ].map(idx)
    order.forEach((i) => expect(i).toBeGreaterThanOrEqual(0))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(state.args["customerProfiles.update"][0]).toMatchObject({ status: "pending-review" })
    expect(state.args["trustProducts.update"][0]).toMatchObject({ status: "pending-review" })
    expect(state.args["brandRegistrations.create"][0]).toMatchObject({ brandType: "STANDARD", mock: false })
    expect(count("usAppToPerson.create")).toBe(0)

    // The number is recorded on the org and in inbound_numbers as a Twilio number.
    expect(state.row.phone_number).toBe("+15125550100")
    expect(state.inserts[0]).toMatchObject({ e164: "+15125550100", provider: "twilio", org_id: ORG, market_id: "MK1" })
    expect(state.row.next_check_at).toBeTruthy()
  })

  test("brand flips APPROVED → campaign created with policy URLs, v1.2 header and mock mirroring the org", async () => {
    state.row = baseRow({ spend_approved_at: "2026-10-14T01:00:00Z", mock_registration: true })
    await advanceRegistration(ORG, { reason: "approved" })
    expect(state.args["brandRegistrations.create"][0]).toMatchObject({ mock: true })
    expect(count("usAppToPerson.create")).toBe(0)

    state.brandStatus = "APPROVED"
    const res = await advanceRegistration(ORG, { reason: "brand-registered" })

    expect(res.stage).toBe("in_review")
    expect(count("brandRegistrations.create")).toBe(1)
    expect(count("incomingPhoneNumbers.create")).toBe(1)
    const created = state.args["usAppToPerson.create"]
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      brandRegistrationSid: "BN1",
      usAppToPersonUsecase: "MARKETING",
      privacyPolicyUrl: "https://acme.listhit.io/privacy",
      termsAndConditionsUrl: "https://acme.listhit.io/terms",
      xTwilioApiVersion: "v1.2",
    })
    expect(state.args["a2p_registration.update"][0]).toMatchObject({
      privacy_policy_url: "https://acme.listhit.io/privacy",
      terms_url: "https://acme.listhit.io/terms",
    })
    expect(state.row.campaign_sid).toBe("QE1")
  })

  test("campaign VERIFIED → live, live_at set, live notify once", async () => {
    state.row = baseRow({ spend_approved_at: "2026-10-14T01:00:00Z" })
    state.brandStatus = "APPROVED"
    state.campaignStatus = "VERIFIED"

    const res = await advanceRegistration(ORG, { reason: "campaign-approved" })
    expect(res.stage).toBe("live")
    expect(state.row.setup_stage).toBe("live")
    expect(state.row.live_at).toBeTruthy()
    expect(state.row.a2p_status).toBe("verified")
    expect(notify.notifyLive).toHaveBeenCalledTimes(1)
    expect(notify.notifyLive).toHaveBeenCalledWith(ORG, "+15125550100")

    await advanceRegistration(ORG, { reason: "cron" })
    expect(notify.notifyLive).toHaveBeenCalledTimes(1)
    expect(count("usAppToPerson.create")).toBe(1)
  })

  test("brand FAILED → action_required with mapped, fixable issues", async () => {
    state.row = baseRow({ spend_approved_at: "2026-10-14T01:00:00Z" })
    state.brandStatus = "FAILED"
    state.brandErrors = [{ error_code: 30893, description: "Sample messages are unclear." }]

    const res = await advanceRegistration(ORG, { reason: "brand-failure" })
    expect(res.stage).toBe("action_required")
    expect(state.row.customer_issues).toEqual([
      expect.objectContaining({ field: "samples", fixable: true, code: "30893" }),
    ])
    expect(state.row.a2p_status).toBe("failed")
    expect(notify.notifyActionRequired).toHaveBeenCalledTimes(1)
    expect(count("usAppToPerson.create")).toBe(0)
  })

  test("desired number unavailable → searches the same area code and buys from it", async () => {
    state.row = baseRow({
      spend_approved_at: "2026-10-14T01:00:00Z",
      desired_phone_number: "+17375550199",
      desired_area_code: null,
    })
    state.desiredFails = true
    state.available = [{ phoneNumber: "+17375550111" }]

    await advanceRegistration(ORG, { reason: "approved" })

    const creates = state.args["incomingPhoneNumbers.create"]
    expect(creates[0]).toMatchObject({ phoneNumber: "+17375550199" })
    expect(state.args["availablePhoneNumbers.list"][0]).toMatchObject({ areaCode: 737, smsEnabled: true, voiceEnabled: true })
    expect(creates[1]).toMatchObject({ phoneNumber: "+17375550111", voiceMethod: "POST" })
    expect(creates[1].voiceUrl).toBe("https://app.listhit.io/api/webhooks/twilio-voice-incoming")
    expect(state.row.phone_number).toBe("+17375550111")
  })
})

describe("advanceRegistration — Sole Proprietor path", () => {
  test("not approved: starter profile submitted before the sole-prop TrustProduct is built, both before the spend gate", async () => {
    state.data = soleData()
    state.row = baseRow({ brand_type: "SOLE_PROPRIETOR" })

    const res = await advanceRegistration(ORG, { reason: "submit" })

    expect(res.stage).toBe("awaiting_approval")
    const order = [
      "customerProfiles.create",
      "customerProfiles.evaluate",
      "customerProfiles.update",
      "trustProducts.create",
      "trustProducts.evaluate",
      "trustProducts.update",
    ].map(idx)
    order.forEach((i) => expect(i).toBeGreaterThanOrEqual(0))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(state.args["customerProfiles.create"][0].friendlyName).toContain("Starter Customer Profile")
    expect(state.args["trustProducts.create"][0].friendlyName).toContain("Sole Proprietor Trust Product")
    expect(count("incomingPhoneNumbers.create")).toBe(0)
    expect(count("brandRegistrations.create")).toBe(0)
  })

  test("APPROVED + UNVERIFIED → verify_mobile, no campaign; VERIFIED → SOLE_PROPRIETOR campaign; one number", async () => {
    state.data = soleData()
    state.row = baseRow({ brand_type: "SOLE_PROPRIETOR", spend_approved_at: "2026-10-14T01:00:00Z" })
    state.brandStatus = "APPROVED"
    state.identityStatus = "UNVERIFIED"

    const first = await advanceRegistration(ORG, { reason: "approved" })
    expect(first.stage).toBe("verify_mobile")
    expect(state.args["brandRegistrations.create"][0]).toMatchObject({ brandType: "SOLE_PROPRIETOR" })
    expect(count("usAppToPerson.create")).toBe(0)
    // Starter profile + sole-prop TrustProduct.
    expect(state.args["endUsers.create"].map((a: any) => a.type)).toEqual(
      expect.arrayContaining(["starter_customer_profile_information", "sole_proprietor_information"]),
    )

    state.identityStatus = "VERIFIED"
    const second = await advanceRegistration(ORG, { reason: "brand-verified" })
    expect(second.stage).toBe("in_review")
    expect(state.args["usAppToPerson.create"][0]).toMatchObject({ usAppToPersonUsecase: "SOLE_PROPRIETOR" })

    await advanceRegistration(ORG, { reason: "cron" })
    expect(count("incomingPhoneNumbers.create")).toBe(1)
  })

  test("a number already in the subaccount is adopted, never a second purchase", async () => {
    state.data = soleData()
    state.row = baseRow({ brand_type: "SOLE_PROPRIETOR", spend_approved_at: "2026-10-14T01:00:00Z" })
    state.ownedNumbers = [{ sid: "PNexisting", phoneNumber: "+15125550777", accountSid: "ACsub" }]

    await advanceRegistration(ORG, { reason: "approved" })

    expect(count("incomingPhoneNumbers.create")).toBe(0)
    expect(state.row.phone_number).toBe("+15125550777")
    expect(state.args["services.phoneNumbers.create"][0]).toMatchObject({ phoneNumberSid: "PNexisting" })
  })
})
