import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// Live usage counts for Settings → Tags. The RPC is SECURITY DEFINER and
// service-role only, so it runs through supabaseAdmin with an explicit org id
// AFTER the session and permission check above it.
export async function GET() {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const denied = await requirePermission(supabase, "settings.tags")
  if (denied) return denied

  const { data, error } = await supabaseAdmin.rpc("tag_usage", { p_org_id: orgId })

  if (error) {
    console.error("[tags/usage] rpc failed", { orgId, error })
    return NextResponse.json({ error: "Failed to load tags" }, { status: 500 })
  }

  return NextResponse.json({ tags: data ?? [] })
}
