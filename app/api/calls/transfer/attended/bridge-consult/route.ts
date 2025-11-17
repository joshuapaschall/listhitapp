import { NextRequest, NextResponse } from "next/server";
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx";

export async function POST(request: NextRequest) {
  try {
    const {customerLegId, agentLegId, consultLegId } = await request.json();
        console.log("🔗 Bridging agent to consult");
    console.log("  - Agent leg:", agentLegId);
    console.log("  - Consult leg:", consultLegId);
    if (!agentLegId || !consultLegId || !customerLegId) {
      return NextResponse.json(
        { error: "Missing agentLegId or consultLegId or customerLegId" },
        { status: 400 }
      );
    }
    
    console.log("🔗 Bridging agent to consult");
    console.log("  - Agent leg:", agentLegId);
    console.log("  - Consult leg:", consultLegId);
    
    // Bridge agent to consult leg
    const response = await fetch(
      `${TELNYX_API_URL}/calls/${consultLegId}/actions/bridge`,
      {
        method: 'POST',
        headers: telnyxHeaders(),
        body: JSON.stringify({
          call_control_id: customerLegId,
          command_id: crypto.randomUUID(),
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error("❌ Failed to bridge agent to consult:", error);
      return NextResponse.json(
        { error: "Failed to bridge calls", details: error },
        { status: response.status }
      );
    }
    
    console.log("✅ Agent bridged to consult");
    
    return NextResponse.json({
      success: true,
      message: "Agent connected to consult destination"
    });
    
  } catch (error) {
    console.error("❌ Bridge error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
