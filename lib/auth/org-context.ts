import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

import { supabaseAdmin } from "@/lib/supabase"

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
    console.warn("[org-context] profiles.org_id lookup failed", { userId }, error)
    return null
  }

  // No org on the profile. Interactive requests fail closed — never fall back to
  // an env-controlled default, which would drop the user into another tenant.
  console.warn("[org-context] no org_id on profile; failing closed", { userId })
  return null
}

export async function requireOrgContext() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, orgId: null, supabase }

  const orgId = await resolveOrgIdForUser(user.id)

  return { user, orgId, supabase }
}
