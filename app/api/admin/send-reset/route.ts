import { apiError } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { requireOrgAdmin } from "@/lib/auth/admin-guard"
import { APP_URL, resolveOrgName, sendPasswordResetEmail } from "@/lib/email/account-emails"

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const guard = await requireOrgAdmin(supabase)
  if ("denied" in guard) return guard.denied
  const { ctx } = guard

  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 })

  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("org_id")
    .eq("email", email)
    .eq("org_id", ctx.orgId)
    .maybeSingle()
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })

  // generateLink returns the token without sending anything; we own the email.
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${APP_URL}/set-password` },
  })
  if (error) return apiError(error, 400)

  const hashedToken = data.properties?.hashed_token
  if (!hashedToken) {
    console.error("[admin/send-reset] generateLink returned no hashed_token", { email })
    return NextResponse.json({ error: "Could not generate a reset link." }, { status: 500 })
  }

  const resetUrl = `${APP_URL}/set-password?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`
  const orgName = await resolveOrgName(ctx.orgId)
  const result = await sendPasswordResetEmail({ to: email, resetUrl, orgName })

  return NextResponse.json({
    ok: true,
    emailSent: result.sent,
    // A recovery token is an account-takeover credential. It ships only when the
    // email failed and an admin has to hand-deliver it — never in a success body.
    ...(result.sent ? {} : { resetUrl, emailError: result.error }),
  })
}
