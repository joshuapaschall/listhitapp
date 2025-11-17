import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx";

async function stopMOH(callId: string) {
  await fetch(`${TELNYX_API_URL}/calls/${callId}/actions/playback_stop`, {
    method: 'POST',
    headers: telnyxHeaders(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { customerLegId, agentLegId, consultLegId } = await request.json();
    
    if (!customerLegId || !agentLegId || !consultLegId) {
      return NextResponse.json(
        { error: "Missing required leg IDs" },
        { status: 400 }
      );
    }
    
    console.log("❌ Canceling attended transfer");
    console.log("  - Customer leg:", customerLegId);
    console.log("  - Agent leg:", agentLegId);
    console.log("  - Consult leg:", consultLegId);
    
    // 1) Stop hold music on customer
    await stopMOH(agentLegId);
    console.log("🔇 Stopped hold music");
    
    // 2) Re-bridge customer to agent
    const bridgeResponse = await fetch(
      `${TELNYX_API_URL}/calls/${customerLegId}/actions/bridge`,
      {
        method: 'POST',
        headers: telnyxHeaders(),
        body: JSON.stringify({
          call_control_id: customerLegId,
          command_id: crypto.randomUUID(),
        }),
      }
    );
    
    if (!bridgeResponse.ok) {
      const error = await bridgeResponse.text();
      console.error("❌ Failed to re-bridge customer to agent:", error);
      return NextResponse.json(
        { error: "Failed to cancel transfer", details: error },
        { status: bridgeResponse.status }
      );
    }
    
    console.log("✅ Customer re-bridged to agent");
    
    // 3) Hang up consult leg
    await fetch(`${TELNYX_API_URL}/calls/${consultLegId}/actions/hangup`, {
      method: 'POST',
      headers: telnyxHeaders(),
    });
    
    console.log("✅ Consult call ended");
    
    // Update transfer status
    await supabaseAdmin
      .from("call_transfers")
      .update({ 
        status: "canceled",
        completed_at: new Date().toISOString()
      })
      .eq("consult_leg_id", consultLegId);
    
    return NextResponse.json({
      success: true,
      message: "Transfer canceled, customer reconnected to agent"
    });
    
  } catch (error) {
    console.error("❌ Cancel transfer error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
