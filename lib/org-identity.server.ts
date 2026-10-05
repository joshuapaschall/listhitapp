import { supabaseAdmin } from "@/lib/supabase"

import { orgIdentityFromRow, type OrgIdentity, type OrgIdentityRow } from "@/lib/org-identity"

const IDENTITY_COLUMNS =
  "name,business_name,address_line1,address_line2,city,state,zip,country,phone,website_url"

export async function getOrgIdentity(orgId: string): Promise<OrgIdentity | null> {
  if (!orgId) return null

  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select(IDENTITY_COLUMNS)
    .eq("id", orgId)
    .maybeSingle<OrgIdentityRow>()

  if (error) {
    console.error("[org-identity] lookup failed", { orgId, error })
    return null
  }
  if (!data) {
    console.error("[org-identity] organization not found", { orgId })
    return null
  }

  return orgIdentityFromRow(data)
}
