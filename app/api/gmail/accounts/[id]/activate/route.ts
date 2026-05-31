import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"
import { requirePermission } from "@/lib/permissions/server"

assertServer()

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const denied = await requirePermission(supabase, "gmail.access")
  if (denied) return denied

  const { data: row } = await supabaseAdmin
    .from("gmail_tokens")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle()
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  await supabaseAdmin.from("gmail_tokens").update({ is_active: false }).eq("user_id", user.id)
  const { error } = await supabaseAdmin.from("gmail_tokens").update({ is_active: true }).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
