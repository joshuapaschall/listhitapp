// Pure mapping + validation for TrustHub Secondary Customer Profile
// provisioning. No server, DB, or vendor SDK imports — these are plain
// functions over plain inputs so they are fully unit-testable.

// Twilio docs constant: the Secondary Customer Profile policy SID (ISV model).
export const SECONDARY_CUSTOMER_PROFILE_POLICY_SID = "RNdfbf3fae0e1107f8aded0e7cead80bf5"

// Twilio docs constant: the A2P TrustProduct policy SID (create AND evaluate).
export const TRUST_PRODUCT_POLICY_SID = "RNb0d4771c2c98518d916a3d4cd70a8f8b"

// Standard A2P 10DLC brand type.
export const BRAND_TYPE_STANDARD = "STANDARD"

// business_type is not collected in the app yet; default when null.
export const DEFAULT_BUSINESS_TYPE = "Limited Liability Corporation"

// The merged tenant data the orchestrator assembles from business_verification +
// organizations and passes into the builders below.
export interface ProvisioningInputs {
  legalBusinessName: string
  ein: string
  businessType: string | null
  contactFirstName: string
  contactLastName: string
  contactEmail: string
  // ListHit-owned compliance address the orchestrators resolve from env and pass
  // in. Routes carrier/TCR correspondence to ListHit, never the tenant.
  repEmail: string
  orgPhone: string
  addressLine1: string
  addressLine2?: string | null
  city: string
  state: string
  zip: string
  websiteUrl: string
  socialMediaProfileUrls?: string | null
}

// Strip to digits (explicit [^0-9], not \D), require exactly 9, format XX-XXXXXXX.
export function normalizeEin(ein: string): string {
  const digits = (ein || "").replace(/[^0-9]/g, "")
  if (digits.length !== 9) {
    throw new Error(`Invalid EIN: expected 9 digits, got ${digits.length}`)
  }
  return `${digits.slice(0, 2)}-${digits.slice(2)}`
}

// Basic, permissive email shape check. Rejects empty, whitespace, missing @/domain,
// and stray non-ASCII wrapper characters like the guillemets «» that crept in from
// placeholder data. Not a full RFC validator — just enough to fail fast before Twilio.
export function isValidEmail(value: string): boolean {
  const s = (value || "").trim()
  if (!s || s.length > 254) return false
  return /^[^\s@«»"]+@[^\s@«»"]+\.[^\s@«»"]+$/.test(s)
}

// Normalize a US phone to E.164. Keeps an already-"+"-prefixed value as-is.
export function toE164(phone: string): string {
  const trimmed = (phone || "").trim()
  if (trimmed.startsWith("+")) return trimmed
  const digits = trimmed.replace(/[^0-9]/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  throw new Error(`Invalid phone number: cannot convert "${phone}" to E.164`)
}

export function buildBusinessInformationAttributes(inputs: ProvisioningInputs): Record<string, unknown> {
  return {
    business_name: inputs.legalBusinessName,
    website_url: inputs.websiteUrl,
    business_regions_of_operation: "USA_AND_CANADA",
    business_type: inputs.businessType ?? DEFAULT_BUSINESS_TYPE,
    business_registration_identifier: "EIN",
    business_identity: "direct_customer",
    business_industry: "REAL_ESTATE",
    business_registration_number: normalizeEin(inputs.ein),
    ...(inputs.socialMediaProfileUrls
      ? { social_media_profile_urls: inputs.socialMediaProfileUrls }
      : {}),
  }
}

export function buildAuthorizedRepAttributes(inputs: ProvisioningInputs): Record<string, unknown> {
  return {
    first_name: inputs.contactFirstName,
    last_name: inputs.contactLastName,
    email: inputs.repEmail,
    phone_number: toE164(inputs.orgPhone),
    job_position: "Other",
    business_title: "Owner",
  }
}

// Maps the Twilio legal-structure business_type to the us_a2p company_type enum.
// We never emit "public" (would require stock ticker/exchange we don't collect).
export function mapCompanyType(businessType: string | null | undefined): string {
  const t = (businessType || "").toLowerCase()
  if (t.includes("non-profit") || t.includes("nonprofit") || t.includes("non profit")) return "non_profit"
  if (t.includes("government")) return "government"
  return "private"
}

export function buildA2pMessagingProfileAttributes(inputs: ProvisioningInputs): Record<string, unknown> {
  return {
    company_type: mapCompanyType(inputs.businessType),
    brand_contact_email: inputs.repEmail,
  }
}

// Maps our stored a2p_registration.use_case to a Twilio A2P Campaign use case.
export function mapUseCase(useCase: string | null | undefined): string {
  const u = (useCase || "").toLowerCase()
  if (u.includes("low")) return "LOW_VOLUME"
  if (u.includes("2fa") || u.includes("auth")) return "2FA"
  if (u.includes("mixed")) return "MIXED"
  if (u.includes("market")) return "MARKETING"
  return "MARKETING"
}

export interface CampaignInputs {
  brandRegistrationSid: string
  useCase: string | null
  description: string | null
  sample1: string | null
  sample2: string | null
  optInUrl: string | null
  legalBusinessName: string
  privacyPolicyUrl?: string | null
  termsUrl?: string | null
}

// Builds the UsAppToPerson.create payload. Applies minimum-length padding and guarantees
// >= 2 samples so Twilio's validation passes; throws only if there is truly no sample text.
export function buildCampaignAttributes(inputs: CampaignInputs): Record<string, unknown> {
  const samples = [inputs.sample1, inputs.sample2]
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0)
  if (samples.length === 0) {
    throw new Error("At least one campaign sample message is required.")
  }
  // Ensure 2 samples (duplicate the first if only one was provided) and pad short ones to 20 chars.
  while (samples.length < 2) samples.push(samples[0])
  const paddedSamples = samples.slice(0, 5).map((s) =>
    s.length >= 20 ? s : `${s} — reply STOP to opt out.`.slice(0, 1024),
  )

  const baseDescription =
    (inputs.description ?? "").trim() ||
    `${inputs.legalBusinessName} sends real estate offers, updates, and transactional messages to contacts who opted in.`
  const description = baseDescription.length >= 40
    ? baseDescription
    : `${baseDescription} Recipients have consented to receive these messages.`.slice(0, 4096)

  const messageFlow =
    `Recipients opt in${inputs.optInUrl ? ` at ${inputs.optInUrl}` : ""} by submitting their phone number ` +
    `through a web form or by providing it directly to ${inputs.legalBusinessName}, consenting to receive SMS.`

  return {
    brandRegistrationSid: inputs.brandRegistrationSid,
    description,
    messageFlow: messageFlow.length >= 40 ? messageFlow : `${messageFlow} Consent is captured and stored.`,
    messageSamples: paddedSamples,
    usAppToPersonUsecase: mapUseCase(inputs.useCase),
    hasEmbeddedLinks: true,
    hasEmbeddedPhone: true,
    ...(inputs.privacyPolicyUrl ? { privacyPolicyUrl: inputs.privacyPolicyUrl } : {}),
    ...(inputs.termsUrl ? { termsAndConditionsUrl: inputs.termsUrl } : {}),
  }
}

export interface AddressParams {
  customerName: string
  street: string
  city: string
  region: string
  postalCode: string
  isoCountry: string
  streetSecondary?: string
}

export function buildAddressParams(inputs: ProvisioningInputs): AddressParams {
  return {
    customerName: inputs.legalBusinessName,
    street: inputs.addressLine1,
    city: inputs.city,
    region: inputs.state,
    postalCode: inputs.zip,
    isoCountry: "US",
    ...(inputs.addressLine2 ? { streetSecondary: inputs.addressLine2 } : {}),
  }
}

export type ValidationResult = { ok: true } | { ok: false; missing: string[] }

// Fail-fast check used by the route/orchestrator before any Twilio call.
export function validateProvisioningInputs(inputs: ProvisioningInputs): ValidationResult {
  const missing: string[] = []
  const need = (val: unknown, label: string) => {
    if (typeof val !== "string" || val.trim() === "") missing.push(label)
  }

  need(inputs.legalBusinessName, "legal_business_name")
  // EIN must be present AND resolve to exactly 9 digits.
  if (typeof inputs.ein !== "string" || inputs.ein.replace(/[^0-9]/g, "").length !== 9) {
    missing.push("ein")
  }
  need(inputs.contactFirstName, "contact_first_name")
  need(inputs.contactLastName, "contact_last_name")
  if (typeof inputs.contactEmail !== "string" || !isValidEmail(inputs.contactEmail)) {
    missing.push("contact_email")
  }
  need(inputs.orgPhone, "phone")
  need(inputs.addressLine1, "address_line1")
  need(inputs.city, "city")
  need(inputs.state, "state")
  need(inputs.zip, "zip")
  need(inputs.websiteUrl, "website_url")

  return missing.length ? { ok: false, missing } : { ok: true }
}

// Twilio's CustomerProfile evaluation `results` is an array of requirement objects, often with a
// nested sub-array of field checks. Failing leaves carry `passed: false` and a human-readable
// `failure_reason` (e.g., "Email of Authorized Representative #1 is invalid."); siblings have
// `failure_reason: null`. Recursively collect the real reasons, de-duplicated, preferring
// failure_reason and falling back to friendly_name / object_field.
export function summarizeEvaluationFailures(results: unknown): string {
  const reasons: string[] = []
  const seen = new Set<string>()
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>
      if (o.passed === false) {
        const fr = typeof o.failure_reason === "string" ? o.failure_reason.trim() : ""
        const fn = typeof o.friendly_name === "string" ? o.friendly_name.trim() : ""
        const of = typeof o.object_field === "string" ? o.object_field.trim() : ""
        const reason = fr || fn || of
        if (reason && !seen.has(reason)) {
          seen.add(reason)
          reasons.push(reason)
        }
      }
      Object.values(o).forEach(visit)
    }
  }
  visit(results)
  return reasons.length
    ? `Customer Profile evaluation noncompliant: ${reasons.join("; ")}`
    : "Customer Profile evaluation noncompliant"
}
