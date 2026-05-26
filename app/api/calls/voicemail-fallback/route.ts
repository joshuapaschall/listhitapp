import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { playAudioUrl } from "@/lib/voice/call-control";
import { getVoicemailGreetingUrl } from "@/lib/voice/routing";

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

    // Look up the inbound call row (keyed by call_sid = PSTN call_control_id).
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

    // NOTE: do NOT bail on answered_at or status==="completed". In this app the
    // webhook auto-answers the inbound PSTN leg to enable the SIP transfer to the
    // browser, so answered_at is ALWAYS set on inbound calls and "answered"/
    // "completed" do NOT mean a human handled the call. Only bail if the call leg
    // has fully ended (caller hung up) or voicemail was already triggered.
    if (callRow.ended_at || callRow.voicemail) {
      console.log("[voicemail-fallback] skipping — already ended or voicemail", {
        ended_at: callRow.ended_at,
        voicemail: callRow.voicemail,
      });
      return NextResponse.json({ ok: true, action: "already_handled", status: callRow.status });
    }

    // Forwarding is handled in a later prompt; for now 'forward' falls through to voicemail.
    // (browser_first_then_forward / forwarding_only behavior added in Voicemail 6/7.)

    // Voicemail: play the stored greeting to the caller (the PSTN "self" leg).
    const greetingUrl = await getVoicemailGreetingUrl(callRow.to_number ?? "");

    if (greetingUrl) {
      console.log("[voicemail-fallback] playing greeting to PSTN leg", { callControlId, greetingUrl });
      const play = await playAudioUrl(callControlId, greetingUrl, false, "self");
      console.log("[voicemail-fallback] playback_start result", { ok: play.ok, detail: play.ok ? "ok" : play.error });
      if (!play.ok) {
        console.error("[voicemail-fallback] greeting playback failed", play.error, { callControlId });
        return NextResponse.json({ ok: false, error: "Greeting playback failed", detail: play.error }, { status: 500 });
      }
    } else {
      console.warn("[voicemail-fallback] no greeting configured for DID", { to: callRow.to_number, callControlId });
      // No greeting: still flag voicemail so recording can start via a short beep-only path.
      // We start recording immediately with a beep since there's no greeting playback.ended to wait for.
      const { startRecording } = await import("@/lib/voice/call-control");
      await startRecording(callControlId, { play_beep: true });
    }

    // Flag the row so the webhook's playback.ended / recording.saved handlers treat it as voicemail.
    await supabaseAdmin
      .from("calls")
      .update({ voicemail: true, status: "voicemail" })
      .eq("call_sid", callControlId);

    return NextResponse.json({ ok: true, action: "voicemail", hadGreeting: Boolean(greetingUrl) });
  } catch (error) {
    console.error("[voicemail-fallback] error", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
