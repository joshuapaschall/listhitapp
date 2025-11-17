export const runtime = "nodejs"
import { NextRequest, NextResponse } from "next/server"
import { requireAgent } from "@/lib/agent-auth"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    )
  }
  try {
    const agent = await requireAgent()

    console.log("🔍 Debug: Looking for active calls for agent:", agent.id)

    const { data: activeCalls, error } = await supabaseAdmin
      .from("agent_active_calls")
      .select("*")
      .eq("agent_id", agent.id)

    if (error) throw error

    const { data: allActiveCalls } = await supabaseAdmin
      .from("agent_active_calls")
      .select("*")

    return NextResponse.json({
      agentId: agent.id,
      agentActiveCalls: activeCalls || [],
      allActiveCalls: allActiveCalls || [],
      count: activeCalls?.length || 0,
    })
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[agents] route error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    )
  }
  try {
    const agent = await requireAgent()

    console.log("🧹 Cleaning up active calls for agent:", agent.id)

    const { error } = await supabaseAdmin
      .from("agent_active_calls")
      .delete()
      .eq("agent_id", agent.id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: "Active calls cleaned up",
    })
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[agents] route error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    )
  }
}
