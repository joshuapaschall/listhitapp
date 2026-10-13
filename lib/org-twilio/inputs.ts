import "server-only"

import { supabaseAdmin } from "@/lib/supabase"
import type { CustomerIssue, CustomerIssueField } from "@/lib/org-twilio/issues"
import {
  BRAND_TYPE_SOLE_PROPRIETOR,
  validateProvisioningInputs,
  validateSoleProprietorInputs,
  type BrandType,
  type ProvisioningInputs,
  type SoleProprietorInputs,
} from "@/lib/org-twilio/twilio-attributes"

// Loads the customer-entered registration data (business_verification +
// organizations + a2p_registration) and turns it into the builder inputs. One
// place, so the submit route validates exactly what the engine will send.

export type RegistrationData = {
  bv: Record<string, any> | null
  org: Record<string, any> | null
  a2p: Record<string, any> | null
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export async function loadRegistrationData(orgId: string): Promise<RegistrationData> {
  const [{ data: bv }, { data: org }, { data: a2p }] = await Promise.all([
    supabaseAdmin.from("business_verification").select("*").eq("org_id", orgId).maybeSingle(),
    supabaseAdmin.from("organizations").select("*").eq("id", orgId).maybeSingle(),
    supabaseAdmin.from("a2p_registration").select("*").eq("org_id", orgId).maybeSingle(),
  ])
  return { bv: bv ?? null, org: org ?? null, a2p: a2p ?? null }
}

export function standardInputsFrom(data: RegistrationData, websiteUrl: string): ProvisioningInputs {
  const { bv, org } = data
  return {
    legalBusinessName: str(bv?.legal_business_name),
    ein: str(bv?.ein),
    businessType: str(bv?.business_type) || null,
    contactFirstName: str(bv?.contact_first_name),
    contactLastName: str(bv?.contact_last_name),
    contactEmail: str(bv?.contact_email),
    repPhone: str(bv?.rep_phone) || null,
    repTitle: str(bv?.rep_title) || null,
    repJobPosition: str(bv?.rep_job_position) || null,
    orgPhone: str(org?.phone),
    addressLine1: str(org?.address_line1),
    addressLine2: str(org?.address_line2) || null,
    city: str(org?.city),
    state: str(org?.state),
    zip: str(org?.zip),
    websiteUrl,
  }
}

export function soleProprietorInputsFrom(data: RegistrationData): SoleProprietorInputs {
  const { bv, org } = data
  return {
    firstName: str(bv?.contact_first_name),
    lastName: str(bv?.contact_last_name),
    email: str(bv?.contact_email),
    mobilePhone: str(bv?.rep_phone) || str(org?.phone),
    dbaName: str(bv?.dba_name) || null,
    addressLine1: str(org?.address_line1),
    addressLine2: str(org?.address_line2) || null,
    city: str(org?.city),
    state: str(org?.state),
    zip: str(org?.zip),
    ein: str(bv?.ein) || null,
  }
}

// The names a campaign sample may use to identify the sender.
export function brandNamesFrom(data: RegistrationData, brandType: BrandType): string[] {
  const { bv, org } = data
  const names = [str(bv?.dba_name), str(bv?.legal_business_name), str(org?.business_name)]
  if (brandType === BRAND_TYPE_SOLE_PROPRIETOR) {
    names.push(`${str(bv?.contact_first_name)} ${str(bv?.contact_last_name)}`.trim())
  }
  return Array.from(new Set(names.filter(Boolean)))
}

const MISSING_TO_ISSUE: Record<string, { field: CustomerIssueField; message: string }> = {
  legal_business_name: { field: "legal_name", message: "Add your legal business name, exactly as it appears on your IRS EIN letter." },
  ein: { field: "ein", message: "Add your 9-digit EIN." },
  ein_must_be_empty: { field: "ein", message: "Sole proprietor registration is only for businesses without an EIN. Register as a business instead." },
  business_type: { field: "business_type", message: "Choose your business type (LLC, corporation, partnership, co-operative or non-profit)." },
  contact_first_name: { field: "rep", message: "Add your authorized representative's first name." },
  contact_last_name: { field: "rep", message: "Add your authorized representative's last name." },
  contact_email: { field: "rep", message: "Add a valid email for your authorized representative." },
  phone: { field: "rep", message: "Add a valid US mobile number for your authorized representative." },
  rep_phone: { field: "rep", message: "Add a valid US mobile number. You'll confirm it by replying to a text." },
  address_line1: { field: "address", message: "Add your business street address." },
  city: { field: "address", message: "Add your business city." },
  state: { field: "address", message: "Add your business state." },
  zip: { field: "address", message: "Add your business ZIP code." },
  website_url: { field: "website", message: "Add your business website." },
}

function issuesFromMissing(missing: string[]): CustomerIssue[] {
  return missing.map((label) => {
    const mapped = MISSING_TO_ISSUE[label] ?? { field: "other" as const, message: `Complete ${label.replace(/_/g, " ")}.` }
    return { ...mapped, fixable: true }
  })
}

export function validateRegistration(data: RegistrationData, brandType: BrandType, websiteUrl: string): CustomerIssue[] {
  if (brandType === BRAND_TYPE_SOLE_PROPRIETOR) {
    const result = validateSoleProprietorInputs(soleProprietorInputsFrom(data))
    return result.ok ? [] : issuesFromMissing(result.missing)
  }
  const result = validateProvisioningInputs(standardInputsFrom(data, websiteUrl))
  return result.ok ? [] : issuesFromMissing(result.missing)
}
