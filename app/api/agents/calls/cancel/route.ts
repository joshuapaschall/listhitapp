export const runtime = "nodejs"
import { NextRequest, NextResponse } from "next/server"
import { requireAgent } from "@/lib/agent-auth"
import { supabaseAdmin } from "@/lib/supabase"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    )
  }
  try {
    const agent = await requireAgent()

    console.log("🛑 Agent requesting to cancel outbound call")

    const { data: activeCall } = await supabaseAdmin
      .from("agent_active_calls")
      .select("*")
      .eq("agent_id", agent.id)
      .single()

    if (!activeCall) {
      return NextResponse.json(
        { error: "No active call found" },
        { status: 404 }
      )
    }

    console.log("📞 Found active call:", {
      crmCallId: activeCall.id,
      agentLegId: activeCall.agent_leg_id,
      customerLegId: activeCall.customer_leg_id,
    })

    const cancellations = []

    if (activeCall.agent_leg_id) {
      cancellations.push(
        fetch(`${TELNYX_API_URL}/calls/${activeCall.agent_leg_id}/actions/hangup`, {
          method: 'POST',
          headers: telnyxHeaders(),
          body: JSON.stringify({})
        }).catch(err => console.log("⚠️ Agent leg hangup failed:", err))
      )
    }

    if (activeCall.customer_leg_id) {
      cancellations.push(
        fetch(`${TELNYX_API_URL}/calls/${activeCall.customer_leg_id}/actions/hangup`, {
          method: 'POST',
          headers: telnyxHeaders(),
          body: JSON.stringify({})
        }).catch(err => console.log("⚠️ Customer leg hangup failed:", err))
      )
    }

    await Promise.all(cancellations)

    await supabaseAdmin
      .from("agent_active_calls")
      .delete()
      .eq("agent_id", agent.id)

    await supabaseAdmin
      .from("agents")
      .update({
        status: "available",
        last_call_at: new Date().toISOString(),
      })
      .eq("id", agent.id)

    if (activeCall.agent_leg_id) {
      await supabaseAdmin
        .from("calls")
        .update({
          status: "canceled",
          ended_at: new Date().toISOString(),
        })
        .eq("call_sid", activeCall.agent_leg_id)
    }

    console.log("✅ Call canceled successfully")

    return NextResponse.json({
      success: true,
      message: "Call canceled successfully",
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
