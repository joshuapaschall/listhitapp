import "server-only"

import { supabaseAdmin } from "@/lib/supabase"
import { upsertStepStatus } from "@/lib/onboarding/service"
import type {
  EntityType,
  VerificationMergedState,
  VerificationStatus,
} from "@/lib/business-verification/types"

const ENTITY_TYPES: EntityType[] = ["ein_business", "sole_proprietor"]

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
    entity_type: (row?.entity_type as EntityType | null) ?? null,
    legal_business_name: s(row?.legal_business_name),
    ein: s(row?.ein),
    dba_name: s(row?.dba_name),
    contact_first_name: s(row?.contact_first_name),
    contact_last_name: s(row?.contact_last_name),
    contact_email: s(row?.contact_email),
    ein_letter_path: (row?.ein_letter_path as string | null) ?? null,
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

  const entityType = s(body.entity_type) as EntityType
  if (!ENTITY_TYPES.includes(entityType)) return { ok: false, error: "Invalid entity type" }

  // Never accept/store an SSN — drop the field entirely if a client sends one.
  // (No `ssn` / `social_security` is ever read from the body.)

  // EIN only applies to registered businesses; sole proprietors store null.
  let ein: string | null = null
  if (entityType === "ein_business") {
    const parsed = normalizeEin(s(body.ein))
    if (!parsed.ok) return { ok: false, error: "EIN must be 9 digits (XX-XXXXXXX)" }
    ein = parsed.value
  }

  const legalBusinessName = s(body.legal_business_name)
  const dbaName = s(body.dba_name)
  const contactFirst = s(body.contact_first_name)
  const contactLast = s(body.contact_last_name)
  const contactEmail = s(body.contact_email)
  const einLetterPath = s(body.ein_letter_path) || null

  const addressLine1 = s(body.address_line1)
  const addressLine2 = s(body.address_line2)
  const city = s(body.city)
  const state = s(body.state)
  const zip = s(body.zip)
  const phone = s(body.phone)

  // Completeness → "ready". CP-575 is NOT required.
  const baseComplete =
    isNonEmpty(legalBusinessName) &&
    isNonEmpty(contactFirst) &&
    isNonEmpty(contactLast) &&
    isNonEmpty(contactEmail) &&
    isNonEmpty(addressLine1) &&
    isNonEmpty(city) &&
    isNonEmpty(state) &&
    isNonEmpty(zip) &&
    isNonEmpty(phone)
  const einComplete = entityType === "ein_business" ? !!ein : true
  const status: VerificationStatus = baseComplete && einComplete ? "ready" : "draft"

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
      status,
      updated_at: now,
    },
    { onConflict: "org_id" },
  )
  if (upsertErr) return { ok: false, error: upsertErr.message }

  // Keep the organization as the single source of truth for address + phone.
  const { error: orgErr } = await supabaseAdmin
    .from("organizations")
    .update({
      address_line1: addressLine1 || null,
      address_line2: addressLine2 || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      phone: phone || null,
    })
    .eq("id", orgId)
  if (orgErr) return { ok: false, error: orgErr.message }

  // Reflect into onboarding: in_progress on any save, done when ready.
  await upsertStepStatus(orgId, "verify_business", "in_progress")
  if (status === "ready") await upsertStepStatus(orgId, "verify_business", "done")

  const merged = await getVerification(orgId)
  return { ok: true, state: merged }
}
