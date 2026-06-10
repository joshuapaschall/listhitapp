// Shared types for the business-verification (A2P identity) step. Pure types —
// safe to import from both server and client code.

export type EntityType = "ein_business" | "sole_proprietor"
export type VerificationStatus = "draft" | "ready"

// Mirrors the business_verification table.
export interface BusinessVerification {
  id: string
  org_id: string
  entity_type: EntityType | null
  legal_business_name: string | null
  ein: string | null
  dba_name: string | null
  contact_first_name: string | null
  contact_last_name: string | null
  contact_email: string | null
  ein_letter_path: string | null
  status: VerificationStatus
  created_at: string
  updated_at: string
}

// Shape the client form works with: verification fields + the org-sourced
// address/phone fields (the organization remains the single source of truth).
export interface VerificationFormState {
  legal_business_name: string
  ein: string
  dba_name: string
  contact_first_name: string
  contact_last_name: string
  contact_email: string
  ein_letter_path: string | null
  // Org-sourced (saved back to organizations on write).
  address_line1: string
  address_line2: string
  city: string
  state: string
  zip: string
  phone: string
}

// Returned by the service: the merged form state plus the resolved status and the
// org's business_name (used as a default for legal/dba names when empty).
export interface VerificationMergedState extends VerificationFormState {
  status: VerificationStatus
  business_name: string
}
