import { apiError } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { validatePassword } from "@/lib/auth/password-policy"

/**
 * A signed-in user sets their own password — the landing point for both the
 * invite flow and the must-change-password redirect.
 *
 * The write goes through the admin client rather than client.auth.updateUser so
 * the password change and the profile flag clear together server-side, without
 * depending on the profiles UPDATE RLS policy.
 */
export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: "Your session expired. Open your invite link again." },
      { status: 401 },
    )
  }

  const { password } = await request.json()
  const passwordError = validatePassword(password)
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 })

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password })
  if (error) return apiError(error, 400)

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id)
  if (profileError) {
    // The password did change. Failing the request here would send the user back
    // to set it again, so log loudly and let them through — the guard will just
    // ask once more on the next load.
    console.error("[auth/set-password] Failed to clear must_change_password", {
      userId: user.id,
      error: profileError,
    })
  }

  return NextResponse.json({ ok: true })
}
