import { apiError } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { countOrgAdmins, requireOrgAdmin, requireSameOrgTarget } from "@/lib/auth/admin-guard"

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const guard = await requireOrgAdmin(supabase)
  if ("denied" in guard) return guard.denied
  const { ctx } = guard

  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

  // Enforced server-side: the client-only version of this check is bypassable.
  if (userId === ctx.userId) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 })
  }

  const targetResult = await requireSameOrgTarget(userId, ctx)
  if ("denied" in targetResult) return targetResult.denied
  const { target } = targetResult

  if (target.role === "admin" || target.role === "owner") {
    const admins = await countOrgAdmins(ctx.orgId)
    if (admins <= 1) {
      return NextResponse.json(
        { error: "You can't remove the only admin on this organization." },
        { status: 400 },
      )
    }
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) return apiError(error, 400)

  // permissions.user_id is ON DELETE CASCADE against auth.users, so permission
  // rows clean themselves up here.
  const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", userId)
  if (profileError) {
    // The auth user is already gone; a stranded profile row is recoverable and a
    // 500 here would misreport the outcome.
    console.error("[admin/delete-user] auth user deleted but profile row remains", {
      userId,
      error: profileError,
    })
  }

  return NextResponse.json({ success: true })
}
