import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

import { supabaseAdmin } from "@/lib/supabase"
import { resolveOrgIdForUser } from "@/lib/auth/org-context"

export type AdminContext = { userId: string; orgId: string; role: "admin" | "owner" }

export type AdminTarget = { id: string; role: string; org_id: string | null }

// Only `auth` is needed off the caller-scoped client — every privileged read
// below goes through supabaseAdmin so the guard never depends on RLS policies.
// Matches the SupabaseLikeClient convention in lib/permissions/server.ts.
type AuthedClient = Pick<SupabaseClient, "auth">

const ADMIN_ROLES = ["admin", "owner"] as const

/**
 * Gate an admin mutation route. Denials carry a distinct, plain-English message
 * (and a machine-readable `reason` where relevant) because the users page toasts
 * `data.error` verbatim — a bare "Forbidden" is undebuggable from the UI.
 */
export async function requireOrgAdmin(
  client: AuthedClient,
): Promise<{ ctx: AdminContext } | { denied: NextResponse }> {
  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) {
    return {
      denied: NextResponse.json(
        { error: "Your session expired. Sign in again." },
        { status: 401 },
      ),
    }
  }

  // Read the role with the service-role client: the answer must not depend on
  // the profiles SELECT policy.
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    console.error("[admin-guard] failed to read caller role", { userId: user.id }, error)
    return {
      denied: NextResponse.json({ error: "Something went wrong" }, { status: 500 }),
    }
  }

  const role = profile?.role
  if (role !== "admin" && role !== "owner") {
    return {
      denied: NextResponse.json(
        { error: "You need admin access to do this.", reason: "role" },
        { status: 403 },
      ),
    }
  }

  const orgId = await resolveOrgIdForUser(user.id)
  if (!orgId) {
    console.error("[admin-guard] caller has no org", { userId: user.id })
    return {
      denied: NextResponse.json(
        { error: "Your profile isn't assigned to an organization yet.", reason: "no_org" },
        { status: 403 },
      ),
    }
  }

  return { ctx: { userId: user.id, orgId, role } }
}

/**
 * Resolve the mutation target and confirm it lives in the caller's org.
 * A null `target.org_id` is never a match — it produces the cross-org 403.
 */
export async function requireSameOrgTarget(
  targetUserId: string,
  ctx: AdminContext,
): Promise<{ target: AdminTarget } | { denied: NextResponse }> {
  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("id, role, org_id")
    .eq("id", targetUserId)
    .maybeSingle()

  if (!target) {
    return { denied: NextResponse.json({ error: "User not found." }, { status: 404 }) }
  }

  if (target.org_id !== ctx.orgId) {
    return {
      denied: NextResponse.json(
        { error: "That user belongs to a different organization.", reason: "cross_org" },
        { status: 403 },
      ),
    }
  }

  return { target: target as AdminTarget }
}

/** How many admin-or-owner profiles the org has. Used by the last-admin guards. */
export async function countOrgAdmins(orgId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("role", [...ADMIN_ROLES])

  return count ?? 0
}
