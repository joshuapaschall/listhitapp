import { apiError } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { requireOrgAdmin, requireSameOrgTarget } from "@/lib/auth/admin-guard"
import { validatePassword } from "@/lib/auth/password-policy"

/** An admin sets another user's password directly. */
export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const guard = await requireOrgAdmin(supabase)
  if ("denied" in guard) return guard.denied
  const { ctx } = guard

  const { userId, password, requirePasswordChange } = await request.json()
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

  const passwordError = validatePassword(password)
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 })

  const targetResult = await requireSameOrgTarget(userId, ctx)
  if ("denied" in targetResult) return targetResult.denied

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
  if (error) return apiError(error, 400)

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ must_change_password: (requirePasswordChange ?? true) === true })
    .eq("id", userId)
  if (profileError) {
    console.error("[admin/set-password] Failed to update must_change_password", {
      userId,
      error: profileError,
    })
    return NextResponse.json({ error: "Password set, but the change-at-sign-in flag didn't save." }, { status: 500 })
  }

  // The password is never echoed back.
  return NextResponse.json({ ok: true })
}
