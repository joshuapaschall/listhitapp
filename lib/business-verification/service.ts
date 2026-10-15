import "server-only"

import { supabaseAdmin } from "@/lib/supabase"
import { upsertStepStatus } from "@/lib/onboarding/service"
import { formatPhoneE164, isValidPhone } from "@/lib/dedup-utils"
import { REP_JOB_POSITIONS, isValidBusinessType, normalizeBusinessType } from "@/lib/org-twilio/twilio-attributes"
import type {
  EntityType,
  VerificationMergedState,
  VerificationStatus,
} from "@/lib/business-verification/types"


function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function isNonEmpty(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0
}

// Normalize an EIN to "XX-XXXXXXX" or return null when blank/invalid.
// Accepts an optional dash; rejects anything that isn't exactly 9 digits.
function normalizeEin(raw: string): { ok: boolean; value: string | null } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }
  if (!/^\d{2}-?\d{7}$/.test(trimmed)) return { ok: false, value: null }
  const digits = trimmed.replace(/\D/g, "")
  return { ok: true, value: `${digits.slice(0, 2)}-${digits.slice(2)}` }
}

export async function getVerification(orgId: string): Promise<VerificationMergedState> {
  const { data: row } = await supabaseAdmin
    .from("business_verification")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle()

  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("business_name, address_line1, address_line2, city, state, zip, phone")
    .eq("id", orgId)
    .maybeSingle()

  const businessName = s(org?.business_name)

  return {
    entity_type: row?.entity_type === "sole_proprietor" ? "sole_proprietor" : "ein_business",
    legal_business_name: s(row?.legal_business_name),
    ein: s(row?.ein),
    dba_name: s(row?.dba_name),
    contact_first_name: s(row?.contact_first_name),
    contact_last_name: s(row?.contact_last_name),
    contact_email: s(row?.contact_email),
    ein_letter_path: (row?.ein_letter_path as string | null) ?? null,
    business_type: s(row?.business_type),
    rep_title: s(row?.rep_title),
    rep_job_position: s(row?.rep_job_position),
    rep_phone: s(row?.rep_phone),
    address_line1: s(org?.address_line1),
    address_line2: s(org?.address_line2),
    city: s(org?.city),
    state: s(org?.state),
    zip: s(org?.zip),
    phone: s(org?.phone),
    status: (row?.status as VerificationStatus) ?? "draft",
    business_name: businessName,
  }
}

export interface SaveResult {
  ok: boolean
  error?: string
  state?: VerificationMergedState
}

export async function saveVerification(orgId: string, payload: unknown): Promise<SaveResult> {
  const body = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>

  // Two paths: a business with an EIN (LLC, corporation, …) or a sole
  // proprietor without one. The registration engine reads the same columns.
  const entityType: EntityType = body.entity_type === "sole_proprietor" ? "sole_proprietor" : "ein_business"
  const sole = entityType === "sole_proprietor"

  // Never accept/store an SSN — drop the field entirely if a client sends one.
  // (No `ssn` / `social_security` is ever read from the body.)

  const parsed = normalizeEin(sole ? "" : s(body.ein))
  if (!parsed.ok) return { ok: false, error: "EIN must be 9 digits (XX-XXXXXXX)" }
  const ein = parsed.value

  const contactFirst = s(body.contact_first_name)
  const contactLast = s(body.contact_last_name)
  const contactEmail = s(body.contact_email)
  const dbaName = s(body.dba_name)
  // A sole proprietor's legal name is their own name.
  const legalBusinessName = sole ? [contactFirst, contactLast].filter(Boolean).join(" ") : s(body.legal_business_name)
  const einLetterPath = sole ? null : s(body.ein_letter_path) || null

  const businessTypeRaw = s(body.business_type)
  const businessType = !sole && businessTypeRaw && isValidBusinessType(businessTypeRaw) ? normalizeBusinessType(businessTypeRaw) : null
  const repTitle = s(body.rep_title)
  const repJobPosition = (REP_JOB_POSITIONS as readonly string[]).includes(s(body.rep_job_position)) ? s(body.rep_job_position) : ""
  const repPhoneRaw = s(body.rep_phone)
  const repPhone = repPhoneRaw && isValidPhone(repPhoneRaw) ? formatPhoneE164(repPhoneRaw) : null

  const addressLine1 = s(body.address_line1)
  const addressLine2 = s(body.address_line2)
  const city = s(body.city)
  const state = s(body.state)
  const zip = s(body.zip)
  // A sole proprietor's business phone defaults to their mobile.
  const phone = s(body.phone) || (sole && repPhone ? repPhone : "")

  // Completeness → "ready". CP-575 is NOT required.
  const common =
    isNonEmpty(contactFirst) &&
    isNonEmpty(contactLast) &&
    isNonEmpty(contactEmail) &&
    !!repPhone &&
    isNonEmpty(addressLine1) &&
    isNonEmpty(city) &&
    isNonEmpty(state) &&
    isNonEmpty(zip)
  const baseComplete = sole
    ? common
    : common && isNonEmpty(legalBusinessName) && !!ein && !!businessType && isNonEmpty(repTitle) && isNonEmpty(repJobPosition) && isNonEmpty(phone)
  const status: VerificationStatus = baseComplete ? "ready" : "draft"

  const now = new Date().toISOString()
  const { error: upsertErr } = await supabaseAdmin.from("business_verification").upsert(
    {
      org_id: orgId,
      entity_type: entityType,
      legal_business_name: legalBusinessName || null,
      ein,
      dba_name: dbaName || null,
      contact_first_name: contactFirst || null,
      contact_last_name: contactLast || null,
      contact_email: contactEmail || null,
      ein_letter_path: einLetterPath,
      business_type: businessType,
      rep_title: sole ? null : repTitle || null,
      rep_job_position: sole ? null : repJobPosition || null,
      rep_phone: repPhone,
      status,
      updated_at: now,
    },
    { onConflict: "org_id" },
  )
  if (upsertErr) return { ok: false, error: upsertErr.message }

  // The organization stays the single source of truth for the business name,
  // address and phone shown everywhere else (emails, website, settings).
  const displayName = dbaName || legalBusinessName
  const { error: orgErr } = await supabaseAdmin
    .from("organizations")
    .update({
      ...(displayName ? { business_name: displayName } : {}),
      address_line1: addressLine1 || null,
      address_line2: addressLine2 || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      phone: phone || null,
    })
    .eq("id", orgId)
  if (orgErr) return { ok: false, error: orgErr.message }

  // Reflect into the legacy onboarding table: in_progress on any save, done when ready.
  await upsertStepStatus(orgId, "verify_business", "in_progress")
  if (status === "ready") await upsertStepStatus(orgId, "verify_business", "done")

  const merged = await getVerification(orgId)
  return { ok: true, state: merged }
}
