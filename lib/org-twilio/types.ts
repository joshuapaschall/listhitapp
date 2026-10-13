// Shared types for the per-org Twilio resource record. Pure types — no server
// imports, safe to use from client and server.

export type OrgSmsProvider = "telnyx" | "twilio"

export type OrgVoiceProvider = "telnyx" | "twilio"

// The single customer-facing stage the registration engine drives.
export type OrgTwilioSetupStage =
  | "not_started"
  | "awaiting_approval"
  | "submitting"
  | "in_review"
  | "verify_mobile"
  | "action_required"
  | "live"
  | "rejected"

export type OrgTwilioBrandType = "STANDARD" | "SOLE_PROPRIETOR"

export type OrgTwilioA2pStatus =
  | "not_started"
  | "provisioning"
  | "brand_pending"
  | "campaign_pending"
  | "verified"
  | "failed"

// Intermediate Twilio resource SIDs + flags persisted across the multi-step
// Secondary Customer Profile provisioning so a partial run resumes cleanly
// (each step is skipped when its key is already present).
export interface ProvisioningState {
  secondary_profile_sid?: string // BU... (also mirrored to OrgTwilio.secondary_profile_sid)
  business_info_enduser_sid?: string // IT...
  business_info_attached?: boolean
  authorized_rep_enduser_sid?: string // IT...
  authorized_rep_attached?: boolean
  address_sid?: string // AD...
  supporting_document_sid?: string // RD...
  supporting_document_attached?: boolean
  primary_profile_assigned?: boolean
  last_evaluation_status?: "compliant" | "noncompliant"
  last_evaluation_at?: string
  submitted?: boolean
  submitted_at?: string
  // --- T3a brand flow ---
  trust_product_sid?: string
  a2p_profile_enduser_sid?: string
  a2p_profile_attached?: boolean
  customer_profile_attached_to_trust_product?: boolean
  trust_product_evaluation_status?: "compliant" | "noncompliant"
  trust_product_submitted?: boolean
  brand_registration_sid?: string
  brand_status?: string
  // --- T4 messaging flow ---
  messaging_service_sid?: string
  phone_number_sid?: string
  phone_number?: string
  campaign_sid?: string
  campaign_status?: string
  // --- Phase 2B engine ---
  trust_product_status?: string
  tcr_id?: string
  admin_notified_at?: string
  issue_hash?: string
  otp_requested_at?: string
  trust_hub_submitted_at?: string
  // Sole proprietor (starter profile + sole-prop TrustProduct)
  starter_profile_enduser_sid?: string
  starter_profile_enduser_attached?: boolean
  sole_prop_enduser_sid?: string
  sole_prop_enduser_attached?: boolean
}

// Mirrors the org_twilio table.
export interface OrgTwilio {
  id: string
  org_id: string
  sms_provider: OrgSmsProvider
  voice_provider: OrgVoiceProvider
  subaccount_sid: string | null
  secondary_profile_sid: string | null
  trust_product_sid: string | null
  brand_sid: string | null
  brand_status: string | null
  campaign_sid: string | null
  campaign_status: string | null
  messaging_service_sid: string | null
  phone_number: string | null
  phone_number_sid: string | null
  a2p_status: OrgTwilioA2pStatus
  customer_profile_status: string | null
  provisioning_state: ProvisioningState
  provisioning_error: string | null
  setup_stage: OrgTwilioSetupStage
  brand_type: OrgTwilioBrandType | null
  submitted_at: string | null
  spend_approved_at: string | null
  spend_approved_by: string | null
  mock_registration: boolean
  desired_phone_number: string | null
  desired_area_code: string | null
  trust_product_status: string | null
  brand_identity_status: string | null
  brand_errors: unknown[] | null
  campaign_errors: unknown[] | null
  customer_issues: unknown[] | null
  brand_update_count: number
  event_sink_sid: string | null
  event_subscription_sid: string | null
  next_check_at: string | null
  last_checked_at: string | null
  advancing_until: string | null
  live_at: string | null
  live_notified_at: string | null
  issue_notified_at: string | null
  created_at: string
  updated_at: string
}

// Partial used by later PRs to write resource IDs as provisioning progresses.
// org_id / id / created_at are owned by the service, never patched directly.
export type OrgTwilioPatch = Partial<
  Omit<OrgTwilio, "id" | "org_id" | "created_at" | "updated_at">
>
