import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

import { supabaseAdmin } from "@/lib/supabase"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function resolveDefaultOrgId() {
  const envOrg = process.env.DEFAULT_ORG_ID
  return envOrg && UUID_RE.test(envOrg) ? envOrg : null
}

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

  const { data: row } = await supabaseAdmin
    .from("inbound_numbers")
    .select("org_id")
    .limit(1)
    .maybeSingle()

  return row?.org_id ?? resolveDefaultOrgId()
}

export async function requireOrgContext() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, orgId: null, supabase }

  const orgId = await resolveOrgIdForUser(user.id)

  return { user, orgId, supabase }
}
