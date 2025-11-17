export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    )
  }
  try {
    const { data, error } = await supabaseAdmin
      .from("agents")
      .select(`
        id,
        email,
        display_name,
        status,
        sip_username,
        telephony_credential_id,
        created_at,
        last_call_at
      `)
      .order("created_at", { ascending: false })
    if (error) throw error
    return NextResponse.json(data ?? [], {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (e: any) {
    console.error("GET /api/agents/list failed:", e?.message || e)
    return NextResponse.json(
      { error: e?.message || "Failed to fetch agents" },
      { status: 500 },
    )
  }
}
