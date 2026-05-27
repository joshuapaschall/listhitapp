import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx";

type CallControlResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

async function callControlRequest<T = unknown>(
  callControlId: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<CallControlResult<T>> {
  if (!callControlId) {
    return { ok: false, error: "Missing call_control_id" };
  }
  try {
    const res = await fetch(
      `${TELNYX_API_URL}/calls/${encodeURIComponent(callControlId)}/actions/${action}`,
      {
        method: "POST",
        headers: telnyxHeaders(),
        body: JSON.stringify(body ?? {}),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[call-control] ${action} failed:`, res.status, text);
      return { ok: false, error: `${res.status}: ${text || "Telnyx error"}` };
    }
    const data = (await res.json().catch(() => null)) as T;
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[call-control] ${action} error:`, message);
    return { ok: false, error: message };
  }
}

export async function answerCall(callControlId: string) {
  return callControlRequest(callControlId, "answer", {});
}

export async function hangupCall(callControlId: string) {
  return callControlRequest(callControlId, "hangup", {});
}

export async function rejectCall(callControlId: string, cause: string = "CALL_REJECTED") {
  return callControlRequest(callControlId, "reject", { cause });
}

export async function transferCall(
  callControlId: string,
  to: string,
  from: string,
  timeoutSecs: number = 30,
) {
  return callControlRequest(callControlId, "transfer", {
    to,
    from,
    timeout_secs: timeoutSecs,
  });
}

export async function transferToSip(
  callControlId: string,
  sipUri: string,
  from: string,
  timeoutSecs: number = 30,
) {
  return callControlRequest(callControlId, "transfer", {
    to: sipUri,
    from,
    timeout_secs: timeoutSecs,
  });
}

export interface StartRecordingResponse {
  data?: {
    recording_id?: string;
  };
}

export async function startRecording(
  callControlId: string,
  options?: { play_beep?: boolean; commandId?: string; clientState?: string },
) {
  return callControlRequest<StartRecordingResponse>(callControlId, "record_start", {
    channels: "dual",
    format: "mp3",
    ...(options?.play_beep ? { play_beep: true } : {}),
    ...(options?.commandId ? { command_id: options.commandId } : {}),
    ...(options?.clientState ? { client_state: options.clientState } : {}),
  });
}

export async function stopRecording(callControlId: string) {
  return callControlRequest(callControlId, "record_stop", {});
}

export async function sendDTMF(callControlId: string, digits: string) {
  return callControlRequest(callControlId, "send_dtmf", {
    digits,
    duration_millis: 250,
  });
}

export async function playAudioUrl(
  callControlId: string,
  audioUrl: string,
  loop: boolean = false,
  targetLegs: string = "self",
  commandId?: string,
) {
  return callControlRequest(callControlId, "playback_start", {
    audio_url: audioUrl,
    ...(loop ? { loop: "infinity" } : {}),
    target_legs: targetLegs,
    ...(commandId ? { command_id: commandId } : {}),
  });
}

export async function stopPlayback(callControlId: string) {
  return callControlRequest(callControlId, "playback_stop", {});
}

export async function bridgeCall(
  callControlId: string,
  bridgeToCallControlId: string,
  options?: { play_ringtone?: boolean; ringtone_country?: string },
): Promise<CallControlResult> {
  return callControlRequest(callControlId, "bridge", {
    call_control_id: bridgeToCallControlId,
    play_ringtone: options?.play_ringtone ?? true,
    ...(options?.ringtone_country ? { ringtone_country: options.ringtone_country } : {}),
  });
}

export interface DialCallParams {
  to: string;
  from: string;
  connectionId: string;
  answeringMachineDetection?: string;
  clientState?: string;
}

export async function dialCall(
  params: DialCallParams,
): Promise<{ ok: boolean; callControlId?: string; callLegId?: string; callSessionId?: string; error?: string }> {
  try {
    const res = await fetch(`${TELNYX_API_URL}/calls`, {
      method: "POST",
      headers: telnyxHeaders(),
      body: JSON.stringify({
        to: params.to,
        from: params.from,
        connection_id: params.connectionId,
        answering_machine_detection: params.answeringMachineDetection ?? "disabled",
        ...(params.clientState ? { client_state: params.clientState } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[call-control] dialCall failed:", res.status, text);
      return { ok: false, error: `${res.status}: ${text || "Telnyx error"}` };
    }
    const json = (await res.json().catch(() => null)) as {
      data?: { call_control_id?: string; call_leg_id?: string; call_session_id?: string };
    } | null;
    return {
      ok: true,
      callControlId: json?.data?.call_control_id,
      callLegId: json?.data?.call_leg_id,
      callSessionId: json?.data?.call_session_id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[call-control] dialCall error:", message);
    return { ok: false, error: message };
  }
}
