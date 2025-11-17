import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, destination } = await request.json();
    
    if (!sessionId || !destination) {
      return NextResponse.json(
        { error: "Missing sessionId or destination" },
        { status: 400 }
      );
    }

    const callMap = global.callMap || (global.callMap = new Map());
    const callControlId = callMap.get(sessionId);
    
    console.log("🔄 Initiating blind transfer");
    console.log("  - Customer leg:", callControlId);
    console.log("  - Destination:", destination);
    
    // Perform blind transfer on the customer leg
    const response = await fetch(
      `${TELNYX_API_URL}/calls/${callControlId}/actions/transfer`,
      {
        method: "POST",
        headers: telnyxHeaders(),
        body: JSON.stringify({
          to: destination,
          command_id: crypto.randomUUID(),
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error("❌ Transfer failed:", error);
      return NextResponse.json(
        { error: "Transfer failed", details: error },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log("✅ Blind transfer initiated");
    
    // Log transfer in database
    await supabaseAdmin.from("call_transfers").insert({
      call_control_id: callControlId,
      transfer_type: "blind",
      destination,
      initiated_at: new Date().toISOString()
    });
    
    return NextResponse.json({
      success: true,
      message: "Transfer initiated",
      data
    });
    
  } catch (error) {
    console.error("❌ Transfer error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
