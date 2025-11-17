export const runtime = "nodejs"
import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { getCallControlAppId, getTelnyxApiKey } from "@/lib/voice-env"

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    )
  }
  try {
    const { data: agents } = await supabaseAdmin
      .from("agents")
      .select(
        "id, display_name, status, sip_username, telephony_credential_id, last_call_at",
      )
      .order("display_name")

    return NextResponse.json({
      agents: agents || [],
      environment: {
        call_control_app_id: getCallControlAppId(),
        has_api_key: !!getTelnyxApiKey(),
        has_public_key: !!process.env.TELNYX_PUBLIC_KEY,
      },
    })
  } catch (err: any) {
    console.error("[agents] route error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    )
  }
}
