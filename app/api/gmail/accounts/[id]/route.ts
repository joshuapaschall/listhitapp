import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"
import { requirePermission } from "@/lib/permissions/server"

assertServer()

type RouteContext = { params: Promise<{ id: string }> }

export async function DELETE(_: NextRequest, context: RouteContext) {
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
    .select("id, user_id, is_active, refresh_token")
    .eq("id", id)
    .maybeSingle()
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  if (row.refresh_token) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refresh_token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    } catch (err) {
      console.warn("Failed to revoke Google token (continuing anyway):", err)
    }
  }

  const { error } = await supabaseAdmin.from("gmail_tokens").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (row.is_active) {
    const { data: next } = await supabaseAdmin
      .from("gmail_tokens")
      .select("id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (next) {
      await supabaseAdmin.from("gmail_tokens").update({ is_active: true }).eq("id", next.id)
    }
  }

  return new NextResponse(null, { status: 204 })
}
