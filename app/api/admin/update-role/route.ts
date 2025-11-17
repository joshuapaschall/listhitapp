import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  const key = request.headers.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!key || key !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { userId, role } = await request.json()
  if (!userId || !role) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
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
