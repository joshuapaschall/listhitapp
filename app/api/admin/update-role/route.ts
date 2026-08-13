import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { countOrgAdmins, requireOrgAdmin, requireSameOrgTarget } from "@/lib/auth/admin-guard"

// profiles_role_check permits exactly these three.
const VALID_ROLES = new Set(["user", "admin", "owner"])

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const guard = await requireOrgAdmin(supabase)
  if ("denied" in guard) return guard.denied
  const { ctx } = guard

  const { userId, role } = await request.json()
  if (!userId || !role) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }
  if (typeof role !== "string" || !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }
  if (userId === ctx.userId && role === "user") {
    return NextResponse.json(
      { error: "Admins cannot demote their own account" },
      { status: 400 },
    )
  }

  const targetResult = await requireSameOrgTarget(userId, ctx)
  if ("denied" in targetResult) return targetResult.denied
  const { target } = targetResult

  const demoting = role === "user" && (target.role === "admin" || target.role === "owner")
  if (demoting) {
    const admins = await countOrgAdmins(ctx.orgId)
    if (admins <= 1) {
      return NextResponse.json(
        { error: "You can't remove the only admin on this organization." },
        { status: 400 },
      )
    }
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ role })
    .eq("id", userId)
  if (error) {
    console.error("[admin/update-role] Role update failed", { userId, role, error })
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
