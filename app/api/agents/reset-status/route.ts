export const runtime = "nodejs"
import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    )
  }
  try {
    const body = await request.json()
    const { agentId } = body

    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 }
      )
    }

    console.log("🔄 Manually resetting agent status to available")
    console.log("  - Agent ID:", agentId)

    const { data: agent, error: updateError } = await supabaseAdmin
      .from("agents")
      .update({
        status: "available",
        last_call_at: new Date().toISOString(),
      })
      .eq("id", agentId)
      .select()
      .single()

    if (updateError) throw updateError

    await supabaseAdmin
      .from("agent_active_calls")
      .delete()
      .eq("agent_id", agentId)

    console.log("✅ Agent status reset successfully")
    console.log("  - Agent:", agent.display_name)
    console.log("  - New status:", agent.status)

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        display_name: agent.display_name,
        status: agent.status,
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
