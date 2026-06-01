import { supabaseAdmin } from "@/lib/supabase"
import { requireOrgContext } from "@/lib/auth/org-context"

export async function getOrgScopedClient() {
  const { user, orgId, supabase } = await requireOrgContext()
  return { user, orgId, supabase }
}

/**
 * Use only when service-role is required (auth admin, cross-user ops).
 * You MUST filter every query by orgId; RLS does not protect service-role access.
 */
export function scopedAdmin(orgId: string) {
  return { admin: supabaseAdmin, orgId }
}
