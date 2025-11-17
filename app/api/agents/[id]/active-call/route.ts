export const runtime = "nodejs"
import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    )
  }
  try {
    const { id } = params
    console.log("🔍 Fetching active call for agent:", id)

    const { data: activeCall, error } = await supabaseAdmin
      .from("agent_active_calls")
      .select("customer_leg_id, agent_leg_id, consult_leg_id, agent_id, created_at")
      .eq("agent_id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        console.log("📭 No active call found for agent:", id)
        return NextResponse.json({ customerLegId: null })
      }
      throw error
    }

    console.log("✅ Found active call:", activeCall)
    return NextResponse.json({
      customerLegId: activeCall?.customer_leg_id || null,
      agentLegId: activeCall?.agent_leg_id || null,
      consultLegId: activeCall?.consult_leg_id || null,
    })
  } catch (err: any) {
    console.error("[agents] route error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    )
  }
}
