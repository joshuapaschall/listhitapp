import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { resolveOrgIdForUser } from "@/lib/auth/org-context"

// Shared org-scoped site loader for the dashboard site hub. Mirrors the auth
// flow the analytics page already uses: authed user → org → org-scoped site row.
// redirect("/login") when unauthenticated; notFound() when the site isn't the
// caller's org.
export async function loadOwnedSite(id: string, columns = "id,name,slug,status") {
  const supabase = createServerComponentClient({ cookies: () => cookies() })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const orgId = await resolveOrgIdForUser(user.id)
  if (!orgId) redirect("/login")

  const { data: site } = await supabase
    .from("sites")
    .select(columns)
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle()
  if (!site) notFound()

  return { supabase, orgId, user, site: site as any }
}
