import {
  normalizeEin,
  toE164,
  buildBusinessInformationAttributes,
  buildAuthorizedRepAttributes,
  buildAddressParams,
  validateProvisioningInputs,
  isValidEmail,
  summarizeEvaluationFailures,
  SECONDARY_CUSTOMER_PROFILE_POLICY_SID,
  STARTER_CUSTOMER_PROFILE_POLICY_SID,
  SOLE_PROPRIETOR_TRUST_PRODUCT_POLICY_SID,
  normalizeBusinessType,
  buildStarterProfileAttributes,
  buildSoleProprietorAttributes,
  validateSoleProprietorInputs,
  buildMessageFlow,
  CampaignContentError,
  type SoleProprietorInputs,
  mapCompanyType,
  buildA2pMessagingProfileAttributes,
  mapUseCase,
  buildCampaignAttributes,
  type ProvisioningInputs,
  type CampaignInputs,
} from "@/lib/org-twilio/twilio-attributes"

const baseInputs: ProvisioningInputs = {
  legalBusinessName: "Acme Holdings LLC",
  ein: "423209251",
  businessType: "Limited Liability Corporation",
  contactFirstName: "Jane",
  contactLastName: "Doe",
  contactEmail: "jane@acme.com",
  orgPhone: "5125550123",
  addressLine1: "123 Main St",
  addressLine2: "Suite 200",
  city: "Austin",
  state: "TX",
  zip: "78701",
  websiteUrl: "https://acme.com",
}

describe("normalizeEin", () => {
  test("formats a 9-digit string", () => {
    expect(normalizeEin("423209251")).toBe("42-3209251")
  })

  test("strips non-digits before formatting", () => {
    expect(normalizeEin("42-3209251")).toBe("42-3209251")
  })

  test("rejects non-9-digit input", () => {
    expect(() => normalizeEin("12345")).toThrow()
    expect(() => normalizeEin("1234567890")).toThrow()
    expect(() => normalizeEin("")).toThrow()
  })
})

describe("toE164", () => {
  test("prefixes +1 for a 10-digit number", () => {
    expect(toE164("5125550123")).toBe("+15125550123")
  })

  test("prefixes + for an 11-digit number starting with 1", () => {
    expect(toE164("15125550123")).toBe("+15125550123")
  })

  test("keeps an already-+ value", () => {
    expect(toE164("+15125550123")).toBe("+15125550123")
  })

  test("throws on an unconvertible value", () => {
    expect(() => toE164("123")).toThrow()
  })

  test("rejects a short +-prefixed value instead of passing it through", () => {
    expect(() => toE164("+112")).toThrow()
  })
})

describe("buildBusinessInformationAttributes", () => {
  test("returns the fixed ISV enums and the normalized EIN", () => {
    const attrs = buildBusinessInformationAttributes(baseInputs)
    expect(attrs).toMatchObject({
      business_industry: "REAL_ESTATE",
      business_regions_of_operation: "USA_AND_CANADA",
      business_identity: "direct_customer",
      business_registration_identifier: "EIN",
      business_registration_number: "42-3209251",
      business_name: "Acme Holdings LLC",
      website_url: "https://acme.com",
    })
  })

  // Behaviour change (2B): no silent default — an unknown/missing type is a validation error.
  test("throws when business_type is null (never silently defaulted)", () => {
    expect(() => buildBusinessInformationAttributes({ ...baseInputs, businessType: null })).toThrow(/business type/i)
  })

  test("normalizes an alias business_type to Twilio's enum", () => {
    const attrs = buildBusinessInformationAttributes({ ...baseInputs, businessType: "llc" })
    expect(attrs.business_type).toBe("Limited Liability Corporation")
  })

  test("honors a provided business_type", () => {
    const attrs = buildBusinessInformationAttributes({ ...baseInputs, businessType: "Corporation" })
    expect(attrs.business_type).toBe("Corporation")
  })

  test("omits social_media_profile_urls when not provided", () => {
    const attrs = buildBusinessInformationAttributes(baseInputs)
    expect("social_media_profile_urls" in attrs).toBe(false)
  })
})

describe("buildAuthorizedRepAttributes", () => {
  test("returns rep fields with E.164 phone and the defaults (CEO / Owner)", () => {
    const attrs = buildAuthorizedRepAttributes(baseInputs)
    expect(attrs).toMatchObject({
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@acme.com",
      phone_number: "+15125550123",
      job_position: "CEO",
      business_title: "Owner",
    })
  })

  // Behaviour change (2B): the rep is the customer, not ListHit.
  test("email is the customer's contactEmail, never a ListHit address", () => {
    const attrs = buildAuthorizedRepAttributes({ ...baseInputs, contactEmail: "tenant@acme.com" })
    expect(attrs.email).toBe("tenant@acme.com")
    expect(attrs.email).not.toBe("compliance@listhit.io")
  })

  test("uses the customer's rep phone, title and job position when provided", () => {
    const attrs = buildAuthorizedRepAttributes({
      ...baseInputs,
      repPhone: "(512) 555-9999",
      repTitle: "Managing Member",
      repJobPosition: "GM",
    })
    expect(attrs.phone_number).toBe("+15125559999")
    expect(attrs.business_title).toBe("Managing Member")
    expect(attrs.job_position).toBe("GM")
  })

  test("falls back to the org phone when repPhone is blank", () => {
    const attrs = buildAuthorizedRepAttributes({ ...baseInputs, repPhone: "  " })
    expect(attrs.phone_number).toBe("+15125550123")
  })
})

describe("normalizeBusinessType", () => {
  test.each([
    ["llc", "Limited Liability Corporation"],
    ["LLC", "Limited Liability Corporation"],
    ["limited liability company", "Limited Liability Corporation"],
    ["corp", "Corporation"],
    ["inc", "Corporation"],
    ["partnership", "Partnership"],
    ["Corporation", "Corporation"],
    ["Non-profit Corporation", "Non-profit Corporation"],
  ])("maps %s → %s", (input, expected) => {
    expect(normalizeBusinessType(input)).toBe(expected)
  })

  test("throws on unknown or empty input", () => {
    expect(() => normalizeBusinessType("sole trader")).toThrow()
    expect(() => normalizeBusinessType("")).toThrow()
    expect(() => normalizeBusinessType(null)).toThrow()
  })
})

describe("mapCompanyType", () => {
  test("maps an LLC to private", () => {
    expect(mapCompanyType("Limited Liability Corporation")).toBe("private")
  })

  test("maps a non-profit to non_profit", () => {
    expect(mapCompanyType("Non-profit Corporation")).toBe("non_profit")
  })

  test("maps government to government", () => {
    expect(mapCompanyType("Government")).toBe("government")
  })

  test("defaults null to private", () => {
    expect(mapCompanyType(null)).toBe("private")
  })
})

describe("buildA2pMessagingProfileAttributes", () => {
  // Behaviour change (2B): brand contact is the customer's email.
  test("returns private company_type and the customer's email as brand_contact_email", () => {
    const attrs = buildA2pMessagingProfileAttributes(baseInputs)
    expect(attrs.company_type).toBe("private")
    expect(attrs.brand_contact_email).toBe(baseInputs.contactEmail)
  })

  test("never emits stock ticker/exchange keys", () => {
    const attrs = buildA2pMessagingProfileAttributes(baseInputs)
    expect("stock_ticker" in attrs).toBe(false)
    expect("stock_exchange" in attrs).toBe(false)
  })
})

describe("buildAddressParams", () => {
  test("maps address fields with isoCountry US and secondary line", () => {
    expect(buildAddressParams(baseInputs)).toEqual({
      customerName: "Acme Holdings LLC",
      street: "123 Main St",
      city: "Austin",
      region: "TX",
      postalCode: "78701",
      isoCountry: "US",
      streetSecondary: "Suite 200",
    })
  })

  test("omits streetSecondary when no second line", () => {
    const params = buildAddressParams({ ...baseInputs, addressLine2: null })
    expect("streetSecondary" in params).toBe(false)
  })
})

describe("validateProvisioningInputs", () => {
  test("ok for complete inputs", () => {
    expect(validateProvisioningInputs(baseInputs)).toEqual({ ok: true })
  })

  test("reports the full missing list for empty inputs", () => {
    const empty: ProvisioningInputs = {
      legalBusinessName: "",
      ein: "",
      businessType: null,
      contactFirstName: "",
      contactLastName: "",
      contactEmail: "",
      orgPhone: "",
      addressLine1: "",
      addressLine2: null,
      city: "",
      state: "",
      zip: "",
      websiteUrl: "",
    }
    const result = validateProvisioningInputs(empty)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.missing).toEqual([
        "legal_business_name",
        "ein",
        "business_type",
        "contact_first_name",
        "contact_last_name",
        "contact_email",
        "phone",
        "address_line1",
        "city",
        "state",
        "zip",
        "website_url",
      ])
    }
  })

  test("flags ein when it is not 9 digits", () => {
    const result = validateProvisioningInputs({ ...baseInputs, ein: "12345" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.missing).toContain("ein")
  })
})

describe("constants", () => {
  test("policy SID matches the Twilio docs value", () => {
    expect(SECONDARY_CUSTOMER_PROFILE_POLICY_SID).toBe("RNdfbf3fae0e1107f8aded0e7cead80bf5")
  })
})

describe("isValidEmail", () => {
  test("accepts a normal address", () => {
    expect(isValidEmail("josh@listhit.io")).toBe(true)
  })

  test("rejects guillemet-wrapped placeholder data", () => {
    expect(isValidEmail("«josh@listhit.io»")).toBe(false)
  })

  test("rejects internal whitespace", () => {
    expect(isValidEmail("josh @listhit.io")).toBe(false)
  })

  test("rejects a missing @/domain", () => {
    expect(isValidEmail("joshlisthit.io")).toBe(false)
  })

  test("rejects empty", () => {
    expect(isValidEmail("")).toBe(false)
  })
})

describe("validateProvisioningInputs — email", () => {
  test("a fully-valid input set is ok", () => {
    expect(validateProvisioningInputs(baseInputs)).toEqual({ ok: true })
  })

  test("a malformed email fails with contact_email in missing", () => {
    const result = validateProvisioningInputs({ ...baseInputs, contactEmail: "«josh@listhit.io»" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.missing).toContain("contact_email")
  })
})

describe("mapUseCase", () => {
  test("maps low-volume phrasing to LOW_VOLUME", () => {
    expect(mapUseCase("Low Volume Mixed")).toBe("LOW_VOLUME")
  })

  test("maps 2fa / auth to 2FA", () => {
    expect(mapUseCase("2fa")).toBe("2FA")
    expect(mapUseCase("authentication")).toBe("2FA")
  })

  test("maps mixed to MIXED", () => {
    expect(mapUseCase("mixed")).toBe("MIXED")
  })

  test("maps marketing to MARKETING", () => {
    expect(mapUseCase("marketing")).toBe("MARKETING")
  })

  test("defaults null/unknown to MARKETING", () => {
    expect(mapUseCase(null)).toBe("MARKETING")
    expect(mapUseCase("something else")).toBe("MARKETING")
  })
})

describe("buildCampaignAttributes", () => {
  const FLOW =
    "Buyers opt in on the Acme signup form at https://acme.com with unchecked consent boxes. Reply STOP to opt out, HELP for help."
  const campaignBase: CampaignInputs = {
    brandRegistrationSid: "BN123",
    useCase: "marketing",
    description:
      "This campaign sends off-market real estate deals and list updates to buyers who opted in via our web form.",
    samples: [
      "Acme: New off-market deal in Austin — 3bd/2ba, asking $450k. Reply YES for details. Reply STOP to opt out.",
      "Acme: Here's the info on 123 Main St you asked about: link. Reply with questions. Reply STOP to opt out.",
    ],
    optInUrl: "https://acme.com",
    legalBusinessName: "Acme Holdings LLC",
    brandNames: ["Acme"],
    messageFlow: FLOW,
    privacyPolicyUrl: "https://acme.com/privacy",
    termsUrl: "https://acme.com/terms",
  }

  test("produces a valid payload with 2 samples and the MARKETING use case", () => {
    const attrs = buildCampaignAttributes(campaignBase)
    expect(attrs.brandRegistrationSid).toBe("BN123")
    expect(attrs.usAppToPersonUsecase).toBe("MARKETING")
    expect(Array.isArray(attrs.messageSamples)).toBe(true)
    expect((attrs.messageSamples as string[]).length).toBe(2)
    expect(attrs.hasEmbeddedLinks).toBe(true)
    expect(attrs.hasEmbeddedPhone).toBe(true)
  })

  test("sole proprietor brand → SOLE_PROPRIETOR use case", () => {
    const attrs = buildCampaignAttributes({ ...campaignBase, brandType: "SOLE_PROPRIETOR" })
    expect(attrs.usAppToPersonUsecase).toBe("SOLE_PROPRIETOR")
  })

  test("description and messageFlow meet the 40-char minimum; messageFlow is the explicit one", () => {
    const attrs = buildCampaignAttributes(campaignBase)
    expect((attrs.description as string).length).toBeGreaterThanOrEqual(40)
    expect(attrs.messageFlow).toBe(FLOW)
  })

  test("duplicates the single sample when only one provided", () => {
    const attrs = buildCampaignAttributes({ ...campaignBase, samples: [campaignBase.samples[0]] })
    const samples = attrs.messageSamples as string[]
    expect(samples.length).toBe(2)
    expect(samples[0]).toBe(samples[1])
  })

  // Behaviour change (2B): short samples are never padded with filler — they're an error.
  test("short samples throw CampaignContentError instead of being padded", () => {
    let caught: unknown
    try {
      buildCampaignAttributes({ ...campaignBase, samples: ["Acme hi", "Acme yo"] })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(CampaignContentError)
    const issues = (caught as CampaignContentError).issues
    expect(issues.length).toBeGreaterThanOrEqual(2)
    expect(issues.every((i) => i.field === "samples")).toBe(true)
    expect(issues[0].message).toMatch(/at least 20 characters/)
  })

  test("a sample without the brand name → CampaignContentError", () => {
    expect(() =>
      buildCampaignAttributes({
        ...campaignBase,
        samples: [campaignBase.samples[0], "New listing on Main St, 3bd/2ba. Reply STOP to opt out."],
      }),
    ).toThrow(CampaignContentError)
  })

  test("a sample longer than 1024 chars → CampaignContentError", () => {
    expect(() =>
      buildCampaignAttributes({ ...campaignBase, samples: [campaignBase.samples[0], `Acme ${"x".repeat(1100)}`] }),
    ).toThrow(CampaignContentError)
  })

  test("emits all five samples when five are provided", () => {
    const five = [
      "Acme sample one — reply STOP to opt out of these alerts anytime.",
      "Acme sample two — reply STOP to opt out of these alerts anytime.",
      "Acme sample three — reply STOP to opt out of these alerts anytime.",
      "Acme sample four — reply STOP to opt out of these alerts anytime.",
      "Acme sample five — reply STOP to opt out of these alerts anytime.",
    ]
    const attrs = buildCampaignAttributes({ ...campaignBase, samples: five })
    expect((attrs.messageSamples as string[]).length).toBe(5)
  })

  test("slices to five when more than five are provided", () => {
    const six = Array.from({ length: 6 }, (_, i) => `Acme sample ${i + 1} — reply STOP to opt out anytime.`)
    const attrs = buildCampaignAttributes({ ...campaignBase, samples: six })
    expect((attrs.messageSamples as string[]).length).toBe(5)
  })

  test("synthesizes a >=40 char description when none provided", () => {
    const attrs = buildCampaignAttributes({ ...campaignBase, description: null })
    expect((attrs.description as string).length).toBeGreaterThanOrEqual(40)
  })

  // Behaviour change (2B): privacy + terms URLs are always sent; missing ones throw.
  test("always includes the privacy and terms URLs", () => {
    const attrs = buildCampaignAttributes(campaignBase)
    expect(attrs.privacyPolicyUrl).toBe("https://acme.com/privacy")
    expect(attrs.termsAndConditionsUrl).toBe("https://acme.com/terms")
  })

  test("throws without a privacy policy URL", () => {
    expect(() => buildCampaignAttributes({ ...campaignBase, privacyPolicyUrl: null })).toThrow(/privacyPolicyUrl/)
  })

  test("throws without a terms URL", () => {
    expect(() => buildCampaignAttributes({ ...campaignBase, termsUrl: null })).toThrow(/termsUrl/)
  })

  test("throws when there is no sample text", () => {
    let caught: unknown
    try {
      buildCampaignAttributes({ ...campaignBase, samples: [null, "  "] })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(CampaignContentError)
    expect((caught as Error).message).toMatch(/sample message/i)
  })

  test("a missing or too-short messageFlow → CampaignContentError on message_flow", () => {
    let caught: unknown
    try {
      buildCampaignAttributes({ ...campaignBase, messageFlow: "too short" })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(CampaignContentError)
    expect((caught as CampaignContentError).issues.some((i) => i.field === "message_flow")).toBe(true)
  })
})

describe("buildMessageFlow", () => {
  const args = {
    brandName: "Acme Homes",
    siteUrl: "https://acme.listhit.io",
    privacyUrl: "https://acme.listhit.io/privacy",
    termsUrl: "https://acme.listhit.io/terms",
  }

  test.each([true, false])("hasListHitSite=%s: 40–2048 chars with every compliance fact", (hasListHitSite) => {
    const flow = buildMessageFlow({ ...args, hasListHitSite })
    expect(flow.length).toBeGreaterThanOrEqual(40)
    expect(flow.length).toBeLessThanOrEqual(2048)
    expect(flow).toContain("STOP")
    expect(flow).toContain("HELP")
    expect(flow).toContain("rates may apply")
    expect(flow).toContain(args.privacyUrl)
    expect(flow).toContain(args.termsUrl)
    expect(flow).toContain(args.siteUrl)
    expect(flow.toLowerCase()).toContain("checkbox")
  })
})

describe("sole proprietor builders", () => {
  const sp: SoleProprietorInputs = {
    firstName: "Sam",
    lastName: "Seller",
    email: "sam@example.com",
    mobilePhone: "512-555-0199",
    dbaName: null,
    addressLine1: "9 Oak St",
    city: "Austin",
    state: "TX",
    zip: "78702",
    ein: null,
  }

  test("buildStarterProfileAttributes", () => {
    expect(buildStarterProfileAttributes(sp)).toEqual({
      first_name: "Sam",
      last_name: "Seller",
      email: "sam@example.com",
      phone_number: "+15125550199",
    })
  })

  test("buildSoleProprietorAttributes uses First Last when there's no DBA", () => {
    expect(buildSoleProprietorAttributes(sp)).toEqual({
      brand_name: "Sam Seller",
      mobile_phone_number: "+15125550199",
      vertical: "REAL_ESTATE",
    })
  })

  test("buildSoleProprietorAttributes uses the DBA when present", () => {
    expect(buildSoleProprietorAttributes({ ...sp, dbaName: "Sam Buys Houses" }).brand_name).toBe("Sam Buys Houses")
  })

  test("validateSoleProprietorInputs ok for complete inputs", () => {
    expect(validateSoleProprietorInputs(sp)).toEqual({ ok: true })
  })

  test("validateSoleProprietorInputs requires the fields", () => {
    const result = validateSoleProprietorInputs({
      ...sp,
      firstName: "",
      lastName: "",
      email: "bad",
      mobilePhone: "12",
      addressLine1: "",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.missing).toEqual(
        expect.arrayContaining(["contact_first_name", "contact_last_name", "contact_email", "rep_phone", "address_line1"]),
      )
    }
  })

  test("validateSoleProprietorInputs rejects an EIN", () => {
    const result = validateSoleProprietorInputs({ ...sp, ein: "12-3456789" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.missing).toContain("ein_must_be_empty")
  })

  test("policy SIDs match the Twilio docs values", () => {
    expect(STARTER_CUSTOMER_PROFILE_POLICY_SID).toBe("RN806dd6cd175f314e1f96a9727ee271f4")
    expect(SOLE_PROPRIETOR_TRUST_PRODUCT_POLICY_SID).toBe("RN670d5d2e282a6130ae063b234b6019c8")
  })
})

describe("summarizeEvaluationFailures", () => {
  test("surfaces nested failure_reason, prefixed", () => {
    const results = [
      { passed: true, friendly_name: "Business Information", failure_reason: null },
      {
        passed: false,
        friendly_name: "Authorized Representative #1",
        results: [
          { object_field: "email", passed: false, failure_reason: "Email of Authorized Representative #1 is invalid." },
          { object_field: "first_name", passed: true, failure_reason: null },
        ],
      },
    ]
    const summary = summarizeEvaluationFailures(results)
    expect(summary.startsWith("Customer Profile evaluation noncompliant:")).toBe(true)
    expect(summary).toContain("Email of Authorized Representative #1 is invalid.")
  })

  test("returns the bare message when nothing failed", () => {
    const results = [
      { passed: true, friendly_name: "Business Information", failure_reason: null },
      { passed: true, friendly_name: "Authorized Representative #1", failure_reason: null },
    ]
    expect(summarizeEvaluationFailures(results)).toBe("Customer Profile evaluation noncompliant")
  })
})
