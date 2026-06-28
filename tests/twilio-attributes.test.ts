import {
  normalizeEin,
  toE164,
  buildBusinessInformationAttributes,
  buildAuthorizedRepAttributes,
  buildAddressParams,
  validateProvisioningInputs,
  isValidEmail,
  summarizeEvaluationFailures,
  DEFAULT_BUSINESS_TYPE,
  SECONDARY_CUSTOMER_PROFILE_POLICY_SID,
  type ProvisioningInputs,
} from "@/lib/org-twilio/twilio-attributes"

const baseInputs: ProvisioningInputs = {
  legalBusinessName: "Acme Holdings LLC",
  ein: "423209251",
  businessType: null,
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

  test("uses DEFAULT_BUSINESS_TYPE when business_type is null", () => {
    const attrs = buildBusinessInformationAttributes(baseInputs)
    expect(attrs.business_type).toBe(DEFAULT_BUSINESS_TYPE)
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
  test("returns rep fields with E.164 phone and the fixed defaults", () => {
    const attrs = buildAuthorizedRepAttributes(baseInputs)
    expect(attrs).toMatchObject({
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@acme.com",
      phone_number: "+15125550123",
      job_position: "Other",
      business_title: "Owner",
    })
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
