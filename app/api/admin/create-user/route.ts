import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { getUserRole } from "@/lib/get-user-role"

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const role = await getUserRole(supabase)
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { email, password, role: userRole } = await request.json()
  if (!email || !password || !userRole) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }
  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const id = data.user?.id
  if (id) {
    const { error: pErr } = await supabaseAdmin.from("profiles").insert({ id, role: userRole })
    if (pErr) return NextResponse.json({ error: "Profile insert failed" }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
