// Shared types for the per-org Twilio resource record. Pure types — no server
// imports, safe to use from client and server.

export type OrgSmsProvider = "telnyx" | "twilio"

export type OrgTwilioA2pStatus =
  | "not_started"
  | "provisioning"
  | "brand_pending"
  | "campaign_pending"
  | "verified"
  | "failed"

// Mirrors the org_twilio table.
export interface OrgTwilio {
  id: string
  org_id: string
  sms_provider: OrgSmsProvider
  subaccount_sid: string | null
  secondary_profile_sid: string | null
  brand_sid: string | null
  campaign_sid: string | null
  messaging_service_sid: string | null
  phone_number: string | null
  phone_number_sid: string | null
  a2p_status: OrgTwilioA2pStatus
  created_at: string
  updated_at: string
}

// Partial used by later PRs to write resource IDs as provisioning progresses.
// org_id / id / created_at are owned by the service, never patched directly.
export type OrgTwilioPatch = Partial<
  Omit<OrgTwilio, "id" | "org_id" | "created_at" | "updated_at">
>
