import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

import { supabaseAdmin } from "@/lib/supabase"
import { resolveDefaultOrgId } from "@/lib/auth/default-org"

export async function resolveOrgIdForUser(userId: string): Promise<string | null> {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle()

    if (error) throw error
    if (profile?.org_id) return profile.org_id
  } catch (error) {
    console.warn("[org-context] Falling back after profiles.org_id lookup failed", error)
  }

  // No org on the profile — fall back to the env-controlled default ONLY. Never
  // borrow an org from a data table (that could assign a user to another tenant).
  return resolveDefaultOrgId()
}

export async function requireOrgContext() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, orgId: null, supabase }

  const orgId = await resolveOrgIdForUser(user.id)

  return { user, orgId, supabase }
}
