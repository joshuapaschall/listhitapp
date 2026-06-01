import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { assertServer } from "@/utils/assert-server"
import { requirePermission } from "@/lib/permissions/server"

assertServer()

export async function GET() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const denied = await requirePermission(supabase, "gmail.access")
  if (denied) return denied

  const { data, error } = await supabase
    .from("gmail_tokens")
    .select("id, email, is_active, updated_at, last_synced_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
