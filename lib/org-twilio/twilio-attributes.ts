// Pure mapping + validation for Twilio ISV A2P 10DLC registration (Standard and
// Sole Proprietor). No server, DB, or vendor SDK imports — these are plain
// functions over plain inputs so they are fully unit-testable.

// Twilio docs constant: the Secondary Customer Profile policy SID (ISV model).
export const SECONDARY_CUSTOMER_PROFILE_POLICY_SID = "RNdfbf3fae0e1107f8aded0e7cead80bf5"

// Twilio docs constant: the A2P TrustProduct policy SID (create AND evaluate).
export const TRUST_PRODUCT_POLICY_SID = "RNb0d4771c2c98518d916a3d4cd70a8f8b"

// Twilio docs constant: the Starter Customer Profile policy SID (sole proprietor).
export const STARTER_CUSTOMER_PROFILE_POLICY_SID = "RN806dd6cd175f314e1f96a9727ee271f4"

// Twilio docs constant: the Sole Proprietor TrustProduct policy SID.
export const SOLE_PROPRIETOR_TRUST_PRODUCT_POLICY_SID = "RN670d5d2e282a6130ae063b234b6019c8"

// A2P 10DLC brand types.
export const BRAND_TYPE_STANDARD = "STANDARD"
export const BRAND_TYPE_SOLE_PROPRIETOR = "SOLE_PROPRIETOR"
export type BrandType = typeof BRAND_TYPE_STANDARD | typeof BRAND_TYPE_SOLE_PROPRIETOR

// Twilio's business_type enum (Secondary Customer Profile business information).
export const BUSINESS_TYPES = [
  "Co-operative",
  "Corporation",
  "Limited Liability Corporation",
  "Non-profit Corporation",
  "Partnership",
] as const
export type BusinessType = (typeof BUSINESS_TYPES)[number]

// Twilio's job_position enum for the authorized representative.
export const REP_JOB_POSITIONS = ["Director", "GM", "VP", "CEO", "CFO", "General Counsel", "Other"] as const

const BUSINESS_TYPE_ALIASES: Record<string, BusinessType> = {
  llc: "Limited Liability Corporation",
  "limited liability company": "Limited Liability Corporation",
  "limited liability corporation": "Limited Liability Corporation",
  corp: "Corporation",
  corporation: "Corporation",
  inc: "Corporation",
  "inc.": "Corporation",
  incorporated: "Corporation",
  partnership: "Partnership",
  "co-operative": "Co-operative",
  cooperative: "Co-operative",
  "co-op": "Co-operative",
  "non-profit corporation": "Non-profit Corporation",
  "nonprofit corporation": "Non-profit Corporation",
  "non-profit": "Non-profit Corporation",
  nonprofit: "Non-profit Corporation",
}

// Map a stored/entered legal structure to Twilio's enum. Unknown or empty input
// is a validation error — never silently defaulted.
export function normalizeBusinessType(input: string | null | undefined): BusinessType {
  const raw = (input ?? "").trim()
  const exact = BUSINESS_TYPES.find((t) => t === raw)
  if (exact) return exact
  const alias = BUSINESS_TYPE_ALIASES[raw.toLowerCase()]
  if (alias) return alias
  throw new Error(`Unknown business type: "${raw}"`)
}

export function isValidBusinessType(input: string | null | undefined): boolean {
  try {
    normalizeBusinessType(input)
    return true
  } catch {
    return false
  }
}

// The merged tenant data the orchestrator assembles from business_verification +
// organizations and passes into the builders below.
export interface ProvisioningInputs {
  legalBusinessName: string
  ein: string
  businessType: string | null
  contactFirstName: string
  contactLastName: string
  contactEmail: string
  // Authorized representative details, entered by the customer. repPhone falls
  // back to orgPhone; title/job position default to Owner/CEO.
  repPhone?: string | null
  repTitle?: string | null
  repJobPosition?: string | null
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

// Normalize a US phone to E.164. An already-"+"-prefixed value must be a full
// US number (+1 and 10 digits).
export function toE164(phone: string): string {
  const trimmed = (phone || "").trim()
  if (trimmed.startsWith("+")) {
    if (/^\+1\d{10}$/.test(trimmed)) return trimmed
    throw new Error(`Invalid phone number: "${phone}" is not a US E.164 number`)
  }
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
    business_type: normalizeBusinessType(inputs.businessType),
    business_registration_identifier: "EIN",
    business_identity: "direct_customer",
    business_industry: "REAL_ESTATE",
    business_registration_number: normalizeEin(inputs.ein),
    ...(inputs.socialMediaProfileUrls
      ? { social_media_profile_urls: inputs.socialMediaProfileUrls }
      : {}),
  }
}

// The customer's own authorized representative — their email, phone and role.
// (ListHit's notification address goes on the profile/TrustProduct `email`, not here.)
export function buildAuthorizedRepAttributes(inputs: ProvisioningInputs): Record<string, unknown> {
  const repPhone = (inputs.repPhone ?? "").trim()
  return {
    first_name: inputs.contactFirstName,
    last_name: inputs.contactLastName,
    email: inputs.contactEmail,
    phone_number: toE164(repPhone || inputs.orgPhone),
    job_position: (inputs.repJobPosition ?? "").trim() || "CEO",
    business_title: (inputs.repTitle ?? "").trim() || "Owner",
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
    brand_contact_email: inputs.contactEmail,
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

// Thrown when the customer's campaign content can't be submitted as-is. Each
// issue names the field to fix; nothing is padded with filler to get past Twilio.
export class CampaignContentError extends Error {
  readonly issues: Array<{ field: string; message: string }>
  constructor(issues: Array<{ field: string; message: string }>) {
    super(issues.map((i) => i.message).join(" "))
    this.name = "CampaignContentError"
    this.issues = issues
  }
}

export interface CampaignInputs {
  brandRegistrationSid: string
  brandType?: BrandType
  useCase?: string | null
  description: string | null
  samples: Array<string | null | undefined>
  optInUrl?: string | null
  legalBusinessName: string
  // Names a sample may use to identify the sender (legal name, DBA). Defaults to
  // the legal business name.
  brandNames?: string[]
  messageFlow?: string | null
  privacyPolicyUrl: string | null | undefined
  termsUrl: string | null | undefined
}

const SAMPLE_MIN = 20
const SAMPLE_MAX = 1024

// Builds the UsAppToPerson.create payload. Description gets a consent sentence when
// short; samples are never padded — each must be 20–1024 chars and name the brand,
// or a CampaignContentError lists what to fix.
export function buildCampaignAttributes(inputs: CampaignInputs): Record<string, unknown> {
  if (!inputs.privacyPolicyUrl) throw new Error("privacyPolicyUrl is required for an A2P campaign.")
  if (!inputs.termsUrl) throw new Error("termsUrl is required for an A2P campaign.")

  const issues: Array<{ field: string; message: string }> = []
  const brandNames = (inputs.brandNames?.length ? inputs.brandNames : [inputs.legalBusinessName])
    .map((n) => (n ?? "").trim())
    .filter(Boolean)

  const provided = (inputs.samples ?? []).map((v) => (v ?? "").trim()).filter((v) => v.length > 0)
  if (provided.length === 0) {
    issues.push({ field: "samples", message: "Add at least one sample message." })
  }
  provided.slice(0, 5).forEach((sample, i) => {
    const label = `Sample message ${i + 1}`
    if (sample.length < SAMPLE_MIN) {
      issues.push({ field: "samples", message: `${label} must be at least ${SAMPLE_MIN} characters.` })
    } else if (sample.length > SAMPLE_MAX) {
      issues.push({ field: "samples", message: `${label} must be ${SAMPLE_MAX} characters or fewer.` })
    }
    const lower = sample.toLowerCase()
    if (brandNames.length && !brandNames.some((n) => lower.includes(n.toLowerCase()))) {
      issues.push({ field: "samples", message: `${label} must include your business name (${brandNames[0]}).` })
    }
  })

  const messageFlow = (inputs.messageFlow ?? "").trim()
  if (messageFlow.length < 40 || messageFlow.length > 2048) {
    issues.push({ field: "message_flow", message: "Describe how buyers opt in (40–2048 characters)." })
  }

  if (issues.length) throw new CampaignContentError(issues)

  // Ensure 2 samples (duplicate the first if only one was provided), cap at 5.
  const samples = provided.slice(0, 5)
  while (samples.length < 2) samples.push(samples[0])

  const baseDescription =
    (inputs.description ?? "").trim() ||
    `${inputs.legalBusinessName} sends real estate offers, updates, and transactional messages to contacts who opted in.`
  const description = (
    baseDescription.length >= 40
      ? baseDescription
      : `${baseDescription} Recipients have consented to receive these messages.`
  ).slice(0, 4096)

  return {
    brandRegistrationSid: inputs.brandRegistrationSid,
    description,
    messageFlow,
    messageSamples: samples,
    usAppToPersonUsecase: inputs.brandType === BRAND_TYPE_SOLE_PROPRIETOR ? "SOLE_PROPRIETOR" : "MARKETING",
    hasEmbeddedLinks: true,
    hasEmbeddedPhone: true,
    privacyPolicyUrl: inputs.privacyPolicyUrl,
    termsAndConditionsUrl: inputs.termsUrl,
  }
}

// The opt-in description carriers review. Every compliance fact is stated: where
// buyers opt in, that consent boxes are unchecked and split by message type, the
// policy links, frequency, rates, STOP/HELP, and that consent is recorded first.
export function buildMessageFlow(args: {
  brandName: string
  siteUrl: string
  privacyUrl: string
  termsUrl: string
  hasListHitSite: boolean
}): string {
  const { brandName, siteUrl, privacyUrl, termsUrl } = args
  const where = args.hasListHitSite
    ? `Buyers opt in on the ${brandName} signup form at ${siteUrl}.`
    : `Buyers opt in on the signup form on the ${brandName} website at ${siteUrl}.`
  const flow = [
    where,
    "The form has two separate consent checkboxes, one for marketing texts and one for non-marketing texts, and neither is checked by default.",
    `Next to the checkboxes is the full consent language with links to the Privacy Policy (${privacyUrl}) and the Terms (${termsUrl}).`,
    "The consent language says message frequency varies, message and data rates may apply, reply STOP to opt out, and reply HELP for help.",
    "The consent text, timestamp and IP address are stored before any message is sent.",
  ].join(" ")
  return flow.length > 2048 ? flow.slice(0, 2048) : flow
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
  return addressParamsFor(inputs.legalBusinessName, inputs)
}

function addressParamsFor(
  customerName: string,
  a: { addressLine1: string; addressLine2?: string | null; city: string; state: string; zip: string },
): AddressParams {
  return {
    customerName,
    street: a.addressLine1,
    city: a.city,
    region: a.state,
    postalCode: a.zip,
    isoCountry: "US",
    ...(a.addressLine2 ? { streetSecondary: a.addressLine2 } : {}),
  }
}

// ---- Sole proprietor (no EIN) ----------------------------------------------

export interface SoleProprietorInputs {
  firstName: string
  lastName: string
  email: string
  mobilePhone: string
  dbaName?: string | null
  addressLine1: string
  addressLine2?: string | null
  city: string
  state: string
  zip: string
  // Must be empty: a business with an EIN registers as Standard.
  ein?: string | null
}

export function soleProprietorBrandName(inputs: SoleProprietorInputs): string {
  return (inputs.dbaName ?? "").trim() || `${inputs.firstName} ${inputs.lastName}`.trim()
}

// starter_customer_profile_information EndUser.
export function buildStarterProfileAttributes(inputs: SoleProprietorInputs): Record<string, unknown> {
  return {
    first_name: inputs.firstName,
    last_name: inputs.lastName,
    email: inputs.email,
    phone_number: toE164(inputs.mobilePhone),
  }
}

// sole_proprietor_information EndUser on the Sole Proprietor TrustProduct.
export function buildSoleProprietorAttributes(inputs: SoleProprietorInputs): Record<string, unknown> {
  return {
    brand_name: soleProprietorBrandName(inputs),
    mobile_phone_number: toE164(inputs.mobilePhone),
    vertical: "REAL_ESTATE",
  }
}

export function buildSoleProprietorAddressParams(inputs: SoleProprietorInputs): AddressParams {
  return addressParamsFor(`${inputs.firstName} ${inputs.lastName}`.trim(), inputs)
}

export function validateSoleProprietorInputs(inputs: SoleProprietorInputs): ValidationResult {
  const missing: string[] = []
  const need = (val: unknown, label: string) => {
    if (typeof val !== "string" || val.trim() === "") missing.push(label)
  }
  need(inputs.firstName, "contact_first_name")
  need(inputs.lastName, "contact_last_name")
  if (typeof inputs.email !== "string" || !isValidEmail(inputs.email)) missing.push("contact_email")
  try {
    toE164(inputs.mobilePhone)
  } catch {
    missing.push("rep_phone")
  }
  need(inputs.addressLine1, "address_line1")
  need(inputs.city, "city")
  need(inputs.state, "state")
  need(inputs.zip, "zip")
  if ((inputs.ein ?? "").replace(/[^0-9]/g, "").length > 0) missing.push("ein_must_be_empty")
  return missing.length ? { ok: false, missing } : { ok: true }
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
  if (!isValidBusinessType(inputs.businessType)) missing.push("business_type")
  need(inputs.contactFirstName, "contact_first_name")
  need(inputs.contactLastName, "contact_last_name")
  if (typeof inputs.contactEmail !== "string" || !isValidEmail(inputs.contactEmail)) {
    missing.push("contact_email")
  }
  try {
    toE164((inputs.repPhone ?? "").trim() || inputs.orgPhone)
  } catch {
    missing.push("phone")
  }
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
