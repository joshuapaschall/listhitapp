import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  const key = request.headers.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!key || key !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { userId, permissionKey, granted } = await request.json()
  if (!userId || !permissionKey || granted === undefined) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }
  const { error } = await supabaseAdmin
    .from("permissions")
    .upsert({ user_id: userId, permission_key: permissionKey, granted })
  if (error) {
    console.error("Permission update failed", error)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
