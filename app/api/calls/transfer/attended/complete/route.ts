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
    const { customerLegId, consultLegId, agentLegId } = await request.json();
    
    if (!customerLegId || !consultLegId || !agentLegId) {
      return NextResponse.json(
        { error: "Missing required leg IDs" },
        { status: 400 }
      );
    }
    
    console.log("✅ Completing attended transfer");
    console.log("  - Customer leg:", customerLegId);
    console.log("  - Consult leg:", consultLegId);
    console.log("  - Agent leg:", agentLegId);
    
    // 1) Stop hold music on customer
    
    await stopMOH(agentLegId);
    console.log("🔇 Stopped hold music");
    
    // 3) Hang up agent
    await fetch(`${TELNYX_API_URL}/calls/${agentLegId}/actions/hangup`, {
      method: 'POST',
      headers: telnyxHeaders(),
    });
    
    console.log("✅ Agent disconnected");
    
    // Update transfer status
    await supabaseAdmin
      .from("call_transfers")
      .update({ 
        status: "completed",
        completed_at: new Date().toISOString()
      })
      .eq("consult_leg_id", consultLegId);
    
    return NextResponse.json({
      success: true,
      message: "Transfer completed successfully"
    });
    
  } catch (error) {
    console.error("❌ Complete transfer error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
