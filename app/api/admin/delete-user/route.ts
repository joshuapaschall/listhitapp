import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { getUserRole } from "@/lib/get-user-role"
import { resolveOrgIdForUser } from "@/lib/auth/org-context"

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const role = await getUserRole(supabase)
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  const orgId = await resolveOrgIdForUser(user.id)
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .maybeSingle()
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (target.org_id !== orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await supabaseAdmin.from("profiles").delete().eq("id", userId)
  return NextResponse.json({ success: true })
}
