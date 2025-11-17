import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("telnyx_credentials")
      .select("sip_username, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    
    return NextResponse.json({
      sip_username: data?.sip_username || null,
      created_at: data?.created_at || null
    })
  } catch (err) {
    console.error("Failed to get current credential:", err)
    return NextResponse.json({ error: "Failed to get credential" }, { status: 500 })
  }
}