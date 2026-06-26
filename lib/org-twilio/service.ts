import "server-only"

import { supabaseAdmin } from "@/lib/supabase"
import type { OrgTwilio, OrgTwilioPatch, ProvisioningState } from "@/lib/org-twilio/types"

// Thin, org-scoped accessors for the org_twilio table. Server-only; every query
// is scoped with .eq("org_id", orgId). No Twilio/external calls here — later PRs
// provision resources and persist the IDs through upsertOrgTwilio.

export async function getOrgTwilio(orgId: string): Promise<OrgTwilio | null> {
  const { data, error } = await supabaseAdmin
    .from("org_twilio")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as OrgTwilio | null) ?? null
}

export async function upsertOrgTwilio(orgId: string, patch: OrgTwilioPatch): Promise<OrgTwilio> {
  const { data, error } = await supabaseAdmin
    .from("org_twilio")
    .upsert(
      { org_id: orgId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "org_id" },
    )
    .select("*")
    .single()
  if (error || !data) throw error || new Error("Failed to upsert org_twilio")
  return data as OrgTwilio
}

// Shallow-merge into provisioning_state so a step write never clobbers SIDs/flags
// persisted by prior steps. Optionally apply a sibling column patch in the same
// upsert (e.g. mirroring secondary_profile_sid, or updating a2p_status).
export async function mergeProvisioningState(
  orgId: string,
  partial: Partial<ProvisioningState>,
  patch?: OrgTwilioPatch,
): Promise<OrgTwilio> {
  const current = await getOrgTwilio(orgId)
  const nextState = { ...(current?.provisioning_state ?? {}), ...partial }
  return upsertOrgTwilio(orgId, { ...(patch ?? {}), provisioning_state: nextState })
}
