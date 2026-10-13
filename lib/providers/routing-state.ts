import "server-only"

import { getOrgTwilio } from "@/lib/org-twilio/service"
import type { ProviderRoutingRow } from "@/lib/providers/sms/routing"
import type { VoiceRoutingRow } from "@/lib/providers/voice/routing"
import { supabaseAdmin } from "@/lib/supabase"

// One loader for the SMS and voice routing decisions: the org_twilio row plus
// whether the org's subaccount credentials exist. Only presence is read from
// org_twilio_credentials — nothing is decrypted here.

export type RoutingState = ProviderRoutingRow &
  VoiceRoutingRow & {
    has_credentials: boolean
  }

export async function loadRoutingState(orgId: string): Promise<RoutingState | null> {
  const [row, credsResult] = await Promise.all([
    getOrgTwilio(orgId),
    supabaseAdmin
      .from("org_twilio_credentials")
      .select("org_id, api_key_sid, twiml_app_sid")
      .eq("org_id", orgId)
      .maybeSingle<{ org_id: string; api_key_sid: string | null; twiml_app_sid: string | null }>(),
  ])
  if (credsResult.error) throw new Error(`org_twilio_credentials lookup failed: ${credsResult.error.message}`)
  const creds = credsResult.data

  if (!row && !creds) return null
  return {
    sms_provider: row?.sms_provider ?? null,
    voice_provider: row?.voice_provider ?? null,
    subaccount_sid: row?.subaccount_sid ?? null,
    brand_status: row?.brand_status ?? null,
    campaign_status: row?.campaign_status ?? null,
    messaging_service_sid: row?.messaging_service_sid ?? null,
    campaign_sid: row?.campaign_sid ?? null,
    phone_number: row?.phone_number ?? null,
    api_key_sid: creds?.api_key_sid ?? null,
    twiml_app_sid: creds?.twiml_app_sid ?? null,
    has_credentials: Boolean(creds),
  }
}
