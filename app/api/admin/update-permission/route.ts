import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { requireOrgAdmin, requireSameOrgTarget } from "@/lib/auth/admin-guard"
import { isPermissionKey } from "@/lib/permissions/keys"

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const guard = await requireOrgAdmin(supabase)
  if ("denied" in guard) return guard.denied
  const { ctx } = guard

  const { userId, permissionKey, granted } = await request.json()
  if (!userId || !permissionKey || granted === undefined) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }
  if (typeof granted !== "boolean") {
    return NextResponse.json({ error: "granted must be a boolean" }, { status: 400 })
  }
  if (typeof permissionKey !== "string" || !isPermissionKey(permissionKey)) {
    return NextResponse.json({ error: "Unknown permission" }, { status: 400 })
  }
  if (userId === ctx.userId && permissionKey === "users.manage" && granted === false) {
    return NextResponse.json(
      { error: "You can't remove your own user-management access." },
      { status: 400 },
    )
  }

  const targetResult = await requireSameOrgTarget(userId, ctx)
  if ("denied" in targetResult) return targetResult.denied

  // `permissions.id` is the PK, so PostgREST's default ON CONFLICT target never
  // fires — the unique constraint must be named explicitly or every re-toggle
  // dies with 23505 on permissions_user_key.
  const row = { user_id: userId, permission_key: permissionKey, granted }
  const { error } = await supabaseAdmin
    .from("permissions")
    .upsert(row, { onConflict: "user_id,permission_key" })
  if (error) {
    console.error("[admin/update-permission] Permission update failed", {
      userId,
      permissionKey,
      error,
    })
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
