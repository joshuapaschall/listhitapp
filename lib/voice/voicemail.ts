import { supabaseAdmin } from "@/lib/supabase/admin";
import { playAudioUrl, startRecording, stopRecording } from "@/lib/voice/call-control";
import { getVoicemailGreetingUrl } from "@/lib/voice/routing";

export interface StartVoicemailResult {
  ok: boolean;
  hadGreeting: boolean;
  callerGone?: boolean;
  error?: string;
}

export async function startVoicemail(
  pstnCallControlId: string,
  did: string | null,
): Promise<StartVoicemailResult> {
  if (!pstnCallControlId) return { ok: false, hadGreeting: false, error: "Missing call_control_id" };

  const { data: pre } = await supabaseAdmin
    .from("calls")
    .select("voicemail")
    .eq("call_sid", pstnCallControlId)
    .maybeSingle();
  if (pre?.voicemail) {
    console.log("[startVoicemail] already voicemail, skipping", { pstnCallControlId });
    return { ok: true, hadGreeting: false };
  }

  try { await stopRecording(pstnCallControlId); } catch {}

  await supabaseAdmin
    .from("calls")
    .update({ voicemail: true, status: "voicemail", recording_state: null })
    .eq("call_sid", pstnCallControlId);

  const greetingCmdId = `vm-greet-${pstnCallControlId}`.slice(0, 127);
  const greetingUrl = await getVoicemailGreetingUrl(did ?? "");
  console.log("[startVoicemail] begin", { pstnCallControlId, did, hasGreeting: Boolean(greetingUrl) });

  if (greetingUrl) {
    const play = await playAudioUrl(pstnCallControlId, greetingUrl, false, "self", greetingCmdId);
    console.log("[startVoicemail] playback_start", { ok: play.ok, detail: play.ok ? "ok" : play.error });
    if (!play.ok) {
      const is422 = typeof play.error === "string" && play.error.startsWith("422");
      if (is422) {
        console.log("[startVoicemail] 422 on greeting => caller gone, aborting", { pstnCallControlId });
        return { ok: false, hadGreeting: true, callerGone: true };
      }
      console.error("[startVoicemail] greeting playback failed; falling back to beep-record", play.error, { pstnCallControlId });
    } else {
      return { ok: true, hadGreeting: true };
    }
  }

  console.warn("[startVoicemail] no greeting configured or playback failed; starting beep-record", { did, pstnCallControlId });
  const rec = await startRecording(pstnCallControlId, {
    play_beep: true,
    commandId: `vm-rec-${pstnCallControlId}`.slice(0, 127),
    clientState: Buffer.from(JSON.stringify({ role: "voicemail_recording" })).toString("base64"),
  });
  if (rec.ok) {
    const vmRecId = rec.data?.data?.recording_id ?? null;
    await supabaseAdmin
      .from("calls")
      .update({ recording_state: "recording", voicemail_recording_id: vmRecId })
      .eq("call_sid", pstnCallControlId);
    console.log("[startVoicemail] voicemail beep-record started", { pstnCallControlId, vmRecId });
  } else {
    const is422 = typeof rec.error === "string" && rec.error.startsWith("422");
    if (is422) return { ok: false, hadGreeting: false, callerGone: true };
    console.error("[startVoicemail] beep-record start failed", rec.error, { pstnCallControlId });
  }
  return { ok: rec.ok, hadGreeting: false, error: rec.ok ? undefined : rec.error };
}
