import { apiError } from "@/lib/api-error"
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { startVoicemail } from "@/lib/voice/voicemail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      call_control_id?: string;
      action?: "voicemail" | "forward";
    };

    const callControlId = body.call_control_id;
    const action = body.action ?? "voicemail";

    if (!callControlId) {
      return NextResponse.json({ ok: false, error: "Missing call_control_id" }, { status: 400 });
    }

    const { data: callRow } = await supabaseAdmin
      .from("calls")
      .select("call_sid, to_number, answered_at, ended_at, status, voicemail")
      .eq("call_sid", callControlId)
      .maybeSingle();

    console.log("[voicemail-fallback] invoked", {
      callControlId,
      action,
      foundRow: Boolean(callRow),
      status: callRow?.status,
      answered_at: callRow?.answered_at,
      ended_at: callRow?.ended_at,
      voicemail: callRow?.voicemail,
      to_number: callRow?.to_number,
    });

    if (!callRow) {
      return NextResponse.json({ ok: false, error: "Call not found" }, { status: 404 });
    }

    if (callRow.ended_at || callRow.voicemail) {
      return NextResponse.json({ ok: true, action: "already_handled", status: callRow.status });
    }

    const result = await startVoicemail(callRow.call_sid, callRow.to_number ?? null);
    return NextResponse.json({
      ok: result.ok,
      action: "voicemail",
      hadGreeting: result.hadGreeting,
      callerGone: result.callerGone ?? false,
      error: result.error,
    });
  } catch (error) {
    return apiError(error, 500, undefined, { ok: false });
  }
}
