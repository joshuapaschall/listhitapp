import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { getUserRole } from "@/lib/get-user-role"

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const currentUserId = session.user.id
  const currentUserRole = await getUserRole(supabase)
  if (currentUserRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { userId, role } = await request.json()
  if (!userId || !role) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }
  if (userId === currentUserId && role !== "admin") {
    return NextResponse.json(
      { error: "Admins cannot demote their own account" },
      { status: 400 },
    )
  }
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ role })
    .eq("id", userId)
  if (error) {
    console.error("Role update failed", error)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
