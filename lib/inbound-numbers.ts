// Inbound DID → owning org. The receiving number is the only tenant signal a
// provider webhook carries, so every inbound path (SMS, voice, HELP replies)
// resolves the org the same way instead of keeping its own copy of this query.

import { supabaseAdmin } from "@/lib/supabase"

export async function resolveOrgIdByDid(e164: string | null | undefined): Promise<string | null> {
  if (!e164) return null

  const { data, error } = await supabaseAdmin
    .from("inbound_numbers")
    .select("org_id")
    .eq("e164", e164)
    .eq("enabled", true)
    .maybeSingle()

  if (error) {
    console.error("[inbound-numbers] DID → org lookup failed", { e164, error })
    return null
  }

  return data?.org_id ?? null
}
