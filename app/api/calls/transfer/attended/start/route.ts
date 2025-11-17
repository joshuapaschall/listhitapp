export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const CALL_CONTROL_APP_ID = process.env.CALL_CONTROL_APP_ID!;
const FROM_NUMBER = process.env.TELNYX_DEFAULT_CALLER_ID!;

async function playMOH(callId: string, url: string =  process.env.DISPOTOOL_BASE_URL +"/sounds/on-hold.mp3") {
  await fetch(`${TELNYX_API_URL}/calls/${callId}/actions/playback_start`, {
    method: 'POST',
    headers: telnyxHeaders(),
    body: JSON.stringify({
      audio_url: url,
      command_id: crypto.randomUUID(),
        "loop": "infinity",
        target_legs:"both"
    }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { customerLegId, agentLegId, destination } = await request.json();



    if ( !customerLegId || !agentLegId || !destination) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }


    console.log("🔄 Starting attended transfer");
    console.log("  - Customer leg:", customerLegId);
    console.log("  - Agent leg:", agentLegId);
    console.log("  - Destination:", destination);

    // 1) Play hold music to customer
    await playMOH(customerLegId!);
    console.log("🎵 Playing hold music to customer");

    // 2) Dial consult leg from Voice API app
    if (!CALL_CONTROL_APP_ID) {
      return NextResponse.json(
        { error: "Call Control application not configured." },
        { status: 500 }
      );
    }

    if (!FROM_NUMBER) {
      console.error("❌ Missing TELNYX_DEFAULT_CALLER_ID");
      return NextResponse.json(
        { error: "Caller ID not configured. Please contact support." },
        { status: 500 }
      );
    }

    const response = await fetch(`${TELNYX_API_URL}/calls`, {
      method: 'POST',
      headers: telnyxHeaders(),
      body: JSON.stringify({
        connection_id: CALL_CONTROL_APP_ID,
        to: destination,
        from: FROM_NUMBER,
        command_id: crypto.randomUUID(),
        client_state: Buffer.from(
          JSON.stringify({
            purpose: 'attended_transfer_consult',
            customer_leg_id: customerLegId,
            agent_leg_id: agentLegId,
          })
        ).toString('base64'),
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ Failed to dial consult leg:", error);
      return NextResponse.json(
        { error: "Failed to dial destination", details: error },
        { status: response.status }
      );
    }

    const { data } = await response.json();
    const consultLegId = data.call_control_id;

    console.log("✅ Consult leg dialing:", consultLegId);

    // Log transfer attempt
    await supabaseAdmin.from("call_transfers").insert({
      call_control_id: customerLegId,
      transfer_type: "attended",
      destination,
      consult_leg_id: consultLegId,
      initiated_at: new Date().toISOString(),
      status: "consulting"
    });

    // Update agent_active_calls with consult leg ID
    await supabaseAdmin
      .from("agent_active_calls")
      .update({ consult_leg_id: consultLegId })
      .eq("agent_leg_id", agentLegId);

    console.log("✅ Updated active call with consult leg ID");

    return NextResponse.json({
      success: true,
      consultLegId,
      message: "Consult call initiated"
    });

  } catch (error) {
    console.error("❌ Attended transfer error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
