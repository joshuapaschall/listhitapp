import { apiError } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { requireOrgAdmin } from "@/lib/auth/admin-guard"

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
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // FIXME(PR B): auth.admin has no resetPasswordForEmail — replaced by generateLink + Resend.
  try {
    const { error } = await (supabaseAdmin.auth.admin as any).resetPasswordForEmail(email)
    if (error) return apiError(error, 400)
  } catch (err) {
    return apiError(err, 500)
  }

  return NextResponse.json({ success: true })
}
