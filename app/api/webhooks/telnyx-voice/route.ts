import { Buffer } from "node:buffer";

import { NextRequest, NextResponse } from "next/server";
import { verifyTelnyxRequest } from "@/lib/telnyx";
import { formatPhoneE164 } from "@/lib/call-validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getWebRTCSipUri } from "@/lib/voice/webrtc-sip";
import { bridgeCall, startRecording, playAudioUrl } from "@/lib/voice/call-control";
import { getRoutingConfig } from "@/lib/voice/routing";
import { FORWARD_RING_TIMEOUT_SECONDS } from "@/lib/voice/constants";
import { startVoicemail } from "@/lib/voice/voicemail";
import {
  TELNYX_API_URL,
  getCallControlAppId,
  getSipCredentialConnectionId,
  getTelnyxApiKey,
} from "@/lib/voice-env";

export const runtime = "nodejs";
const callMap = global.callMap || (global.callMap = new Map());

interface TelnyxEventPayload {
  data?: {
    event_type?: string;
    payload?: {
      call_control_id?: string;
      to?: string;
      to_number?: string;
      direction?: string;
      client_state?: string | null;
    };
  };
  event_type?: string;
  call_control_id?: string;
  to?: string;
  to_number?: string;
  direction?: string;
  client_state?: string | null;
}

interface AgentSessionRow {
  agent_id: string;
  client_id: string;
  last_seen: string;
  status: string;
}

function normE164(raw?: string | null) {
  const formatted = formatPhoneE164(raw || "");
  return formatted || null;
}

async function cc(path: string, body?: any) {
  const apiKey = getTelnyxApiKey();
  if (!apiKey) {
    throw new Error("Missing TELNYX_API_KEY");
  }
  const r = await fetch(`${TELNYX_API_URL}/calls/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`${path} ${r.status} ${text}`);
  }
  return r.json().catch(() => ({}));
}

const buildSipUri = (u?: string | null) =>
  u && /^[A-Za-z0-9_.-]+$/.test(u) ? `sip:${u}@sip.telnyx.com` : null;

async function answer(callControlId: string) {
  return await cc(`${callControlId}/actions/answer`, {});
}
async function transfer(
  callControlId: string,
  to: string,
  fromE164?: string | null,
  timeoutSecs = 30,
  targetLegClientState?: string,
) {
  const body: any = { to, timeout_secs: timeoutSecs };
  if (fromE164) body.from = fromE164;
  if (targetLegClientState) body.target_leg_client_state = targetLegClientState;
  return await cc(`${callControlId}/actions/transfer`, body);
}
async function speak(callControlId: string, text: string) {
  return cc(`${callControlId}/actions/speak`, {
    language: "en-US",
    voice: "female",
    payload: text,
  });
}
async function hangup(callControlId: string) {
  return cc(`${callControlId}/actions/hangup`, {});
}

async function safeAnswerThenTransfer(
  callControlId: string,
  to: string,
  fromE164?: string | null
) {
  try {
    await answer(callControlId);
  } catch (e) {
    console.error("answer error:", e);
  }
  for (let i = 1; i <= 3; i++) {
    try {
      await transfer(callControlId, to, fromE164);
      return true;
    } catch (e: any) {
      const msg = String(e?.message || e);
      console.error(`transfer error attempt ${i}:`, msg);
      if (msg.includes("422") && i < 3) {
        await new Promise((r) => setTimeout(r, 200 * i));
        continue;
      }
      return false;
    }
  }
  return false;
}


async function safeTransfer(
  callControlId: string,
  to: string,
  fromE164: string | null,
  timeoutSecs: number,
  targetLegClientState?: string,
): Promise<boolean> {
  for (let i = 1; i <= 3; i++) {
    try {
      await transfer(callControlId, to, fromE164, timeoutSecs, targetLegClientState);
      return true;
    } catch (e: any) {
      const msg = String(e?.message || e);
      console.error(`[telnyx-voice] transfer attempt ${i} failed:`, msg);
      if (msg.includes("422") && i < 3) {
        await new Promise((r) => setTimeout(r, 200 * i));
        continue;
      }
      return false;
    }
  }
  return false;
}

async function sayAndHangup(callControlId: string, text: string) {
  try {
    await speak(callControlId, text);
    await new Promise((r) => setTimeout(r, 500));
  } catch (e) {
    console.error("speak error:", e);
  } finally {
    try {
      await hangup(callControlId);
    } catch { }
  }
}

function decodeClientState(s?: string | null) {
  if (!s) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(s, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function resolveOrgFromDid(e164?: string | null) {
  if (!e164) return null;

  const { data, error } = await supabaseAdmin
    .from("inbound_numbers")
    .select("org_id")
    .eq("e164", e164)
    .eq("enabled", true)
    .maybeSingle();

  if (error) {
    console.error("Failed to resolve org for inbound number", error);
    return null;
  }

  return data?.org_id ?? null;
}

async function pickAvailableAgent(): Promise<{ id: string, sip_username: string } | null> {
  return null;
}


async function pickOrgFallback(orgId?: string | null): Promise<string | null> {
  if (!orgId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("org_voice_settings")
    .select("fallback_mode, fallback_sip_username")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch org voice settings", error);
    return null;
  }

  if (!data) {
    return null;
  }

  if (data.fallback_mode === "dispatcher_sip" && data.fallback_sip_username) {
    return data.fallback_sip_username;
  }

  if (data.fallback_mode === "none") {
    return null;
  }

  return null;
}

async function pickTargetSipUsername(orgId?: string | null) {
  const available = await pickAvailableAgent();
  if (available) {
    return available;
  }

  const orgFallback = await pickOrgFallback(orgId);
  if (orgFallback) {
    return orgFallback;
  }

  return process.env.FALLBACK_AGENT_SIP_USERNAME || null;
}

export async function POST(req: NextRequest) {
  // Verify the Telnyx Ed25519 signature before any processing.
  const raw = await req.text();
  if (!verifyTelnyxRequest(req, raw)) {
    return new Response("Invalid signature", { status: 403 });
  }

  let body: TelnyxEventPayload | null = null;

  try {
    body = JSON.parse(raw) as TelnyxEventPayload;
  } catch {
    body = null;
  }

  const event = body?.data?.event_type ?? body?.event_type ?? null;
  const payload: any = body?.data?.payload ?? body ?? null;

  const telnyxKey = getTelnyxApiKey();

  if (!telnyxKey) {
    console.error("TELNYX_API_KEY not configured; cannot control calls");
    return NextResponse.json({ ok: true });
  }

  console.log(">>>>>>>>> telnyx-voice <<<<<<<<<");
  console.log(">>>>>>>>> event   : ", event);
  console.log(">>>>>>>>> payload : ", payload);
  console.log(">>>>>>>>> telnyx-voice <<<<<<<<<");

  try {
    const callControlId = payload?.call_control_id ?? body?.call_control_id ?? null;
    if (event === "call.initiated") {
      if (callControlId && payload.call_session_id) {
        callMap.set(payload.call_session_id, callControlId);
      }
      const directionRaw = payload?.direction ?? body?.direction ?? null;
      const direction =
        typeof directionRaw === "string" ? directionRaw.toLowerCase() : null;

      const toRaw = String(payload?.to ?? payload?.to_number ?? "");
      // Skip the WebRTC transfer B-leg. When we transfer an inbound PSTN call to
      // sip:listhitapp@sip.telnyx.com, the Credential Connection fires its OWN
      // call.initiated with `to` set to the bare SIP username ("listhitapp") or a
      // sip: URI. Those legs are routed to the registered browser by Telnyx and must
      // NOT be answered/controlled here — issuing answer() on them returns 422 and
      // tears the call down before the browser can pick up.
      const isPhoneDid = /^\+?\d{7,}$/.test(toRaw.trim());
      if (toRaw.startsWith("sip:") || !isPhoneDid) {
        console.log("[telnyx-voice] skipping non-PSTN leg (transfer B-leg)", { to: toRaw });
        return NextResponse.json({ ok: true });
      }

      // Persist the PSTN leg to the calls table (idempotent on call_sid).
      let callerBlockedAt: string | null = null;
      try {
        const remote = direction === "incoming" ? String(payload?.from ?? "") : toRaw;
        const digits = remote.replace(/\D/g, "");
        const noCc = digits.startsWith("1") ? digits.slice(1) : digits;
        const cands = Array.from(new Set([digits, noCc].filter((d) => d.length >= 10)));
        let buyerId: string | null = null;
        if (cands.length) {
          const orFilter = cands
            .flatMap((d) => [`phone_norm.eq.${d}`, `phone2_norm.eq.${d}`, `phone3_norm.eq.${d}`])
            .join(",");
          const { data: b } = await supabaseAdmin
            .from("buyers").select("id, blocked_at").or(orFilter).limit(1).maybeSingle();
          buyerId = b?.id ?? null;
          callerBlockedAt = (b as any)?.blocked_at ?? null;
        }
        // Stamp the owning org so the org-scoped lookup can see this row under RLS.
        // Null-safe: if we can't resolve it, leave it null (mirrors calls/record).
        const orgDid = direction === "incoming" ? toRaw : String(payload?.from ?? "");
        const callOrgId = await resolveOrgFromDid(orgDid);
        if (callControlId) {
          await supabaseAdmin.from("calls").upsert(
            {
              call_sid: callControlId,
              direction: direction === "incoming" ? "inbound" : "outbound",
              from_number: String(payload?.from ?? ""),
              to_number: toRaw,
              status: "initiated",
              webrtc: true,
              buyer_id: buyerId,
              org_id: callOrgId,
              call_session_id: payload.call_session_id ?? null,
            },
            { onConflict: "call_sid" }
          );
        }
      } catch (e) {
        console.error("[telnyx-voice] call log insert failed", e);
      }

      if (direction === "incoming") {
        const routing = await getRoutingConfig(toRaw);
        const mode = routing.routingMode;
        const needsForward = mode === "forwarding_only" || mode === "browser_first_then_forward";
        const effectiveMode: typeof mode =
          needsForward && !routing.forwardingNumber ? "browser_only" : mode;

        console.log("[telnyx-voice] inbound routing", {
          callControlId, did: toRaw, requestedMode: mode, effectiveMode,
          hasForwardingNumber: Boolean(routing.forwardingNumber),
          browserRingTimeout: routing.browserRingTimeoutSeconds,
        });

        // Bidirectional block: drop an inbound call from a blocked buyer before
        // any answer/routing/voicemail.
        if (callerBlockedAt) {
          await hangup(callControlId);
          return NextResponse.json({ ok: true, blocked: true });
        }

        await answer(callControlId);

        if (effectiveMode === "forwarding_only") {
          const fwd = routing.forwardingNumber!;
          const fwdState = Buffer.from(JSON.stringify({ role: "forward_transfer" })).toString("base64");
          const ok = await safeTransfer(callControlId, fwd, toRaw, FORWARD_RING_TIMEOUT_SECONDS, fwdState);
          if (ok) {
            await supabaseAdmin.from("calls").update({
              status: "ringing",
              routing_mode: "forwarding_only",
              forwarded_to: fwd,
              forwarded_at: new Date().toISOString(),
            }).eq("call_sid", callControlId);
          } else {
            console.error("[telnyx-voice] forwarding_only transfer failed → voicemail", { callControlId });
            await startVoicemail(callControlId, toRaw);
          }
          return NextResponse.json({ ok: true });
        }

        const sipUri = await getWebRTCSipUri();
        if (!sipUri) {
          if (effectiveMode === "browser_first_then_forward" && routing.forwardingNumber) {
            const fwd = routing.forwardingNumber;
            const fwdState = Buffer.from(JSON.stringify({ role: "forward_transfer" })).toString("base64");
            const ok = await safeTransfer(callControlId, fwd, toRaw, FORWARD_RING_TIMEOUT_SECONDS, fwdState);
            if (ok) {
              await supabaseAdmin.from("calls").update({
                status: "ringing",
                routing_mode: effectiveMode,
                forwarded_to: fwd,
                forwarded_at: new Date().toISOString(),
              }).eq("call_sid", callControlId);
            } else {
              await startVoicemail(callControlId, toRaw);
            }
          } else {
            await startVoicemail(callControlId, toRaw);
          }
          return NextResponse.json({ ok: true });
        }

        const bLegState = Buffer.from(JSON.stringify({ role: "browser_transfer" })).toString("base64");
        const now = new Date();
        const ok = await safeTransfer(callControlId, sipUri, payload.from, routing.browserRingTimeoutSeconds, bLegState);
        if (ok) {
          await supabaseAdmin.from("calls").update({
            status: "ringing",
            routing_mode: effectiveMode,
            forwarded_to: sipUri,
            forwarded_at: now.toISOString(),
            browser_ring_timeout_at: new Date(now.getTime() + routing.browserRingTimeoutSeconds * 1000).toISOString(),
          }).eq("call_sid", callControlId);
        } else {
          if (effectiveMode === "browser_first_then_forward" && routing.forwardingNumber) {
            const fwd = routing.forwardingNumber;
            const fwdState = Buffer.from(JSON.stringify({ role: "forward_transfer" })).toString("base64");
            const fOk = await safeTransfer(callControlId, fwd, toRaw, FORWARD_RING_TIMEOUT_SECONDS, fwdState);
            if (fOk) {
              await supabaseAdmin.from("calls").update({
                status: "ringing", routing_mode: effectiveMode,
                forwarded_to: fwd, forwarded_at: new Date().toISOString(),
              }).eq("call_sid", callControlId);
            } else {
              await startVoicemail(callControlId, toRaw);
            }
          } else {
            await startVoicemail(callControlId, toRaw);
          }
        }
        return NextResponse.json({ ok: true });
      }

      if (direction === "outgoing") {
        return NextResponse.json({ ok: true });
      }
    }


    if (event === "call.bridged") {
      console.log("[telnyx-voice] call.bridged (no-op for answered tracking)", {
        session: payload?.call_session_id ?? null, leg: callControlId,
      });
      return NextResponse.json({ ok: true });
    }

    if (event === "call.answered") {
      try {
        if (callControlId) {
          await supabaseAdmin
            .from("calls")
            .update({ status: "answered", answered_at: new Date().toISOString() })
            .eq("call_sid", callControlId);
        }
      } catch (e) {
        console.error("[telnyx-voice] call log answered update failed", e);
      }
      // Auto-start recording on the PSTN leg (the leg whose call_sid we logged).
      // channels:"dual" captures both sides of the bridge. Only fire on the leg
      // that matches a live calls row, so we don't double-record the browser leg.
      try {
        if (callControlId) {
          const { data: row } = await supabaseAdmin
            .from("calls")
            .select("call_sid, recording_state")
            .eq("call_sid", callControlId)
            .maybeSingle();
          if (row?.call_sid && row.recording_state !== "recording") {
            const rec = await startRecording(callControlId);
            if (rec.ok) {
              await supabaseAdmin
                .from("calls")
                .update({ recording_state: "recording" })
                .eq("call_sid", callControlId);
              console.log("[telnyx-voice] recording started", { callControlId });
            } else {
              console.error("[telnyx-voice] record_start failed", rec.error);
            }
          }
        }
      } catch (e) {
        console.error("[telnyx-voice] auto-record start failed", e);
      }
      // If this is the browser B-leg of a server-originated outbound call, bridge
      // it to the prospect A-leg carried in client_state. Leaves all other
      // call.answered events (including the prospect leg) untouched.
      const cs = decodeClientState(payload?.client_state ?? body?.client_state);
      if (cs?.action === "bridge_outbound" && cs?.prospectCallControlId && callControlId) {
        const bridged = await bridgeCall(callControlId, cs.prospectCallControlId);
        if (!bridged.ok) {
          console.error("[telnyx-voice] outbound bridge failed", bridged.error);
        } else {
          console.log("[telnyx-voice] bridged browser leg to prospect", {
            browser: callControlId,
            prospect: cs.prospectCallControlId,
          });
        }
      }
      if (callControlId && payload?.call_session_id) {
        // Is this the logged leg itself? Then it's the A-leg/prospect leg, not the browser.
        const { data: selfRow } = await supabaseAdmin
          .from("calls")
          .select("call_sid")
          .eq("call_sid", callControlId)
          .maybeSingle();
        if (!selfRow) {
          const { data: aLeg } = await supabaseAdmin
            .from("calls")
            .select("call_sid, forwarded_to, routing_mode")
            .eq("call_session_id", payload.call_session_id)
            .neq("call_sid", callControlId)
            .maybeSingle();

          const fwdTo = typeof aLeg?.forwarded_to === "string" ? aLeg.forwarded_to : null;
          const isPstnForward = fwdTo != null && !fwdTo.startsWith("sip:");

          if (isPstnForward && aLeg?.call_sid) {
            const { error: updErr } = await supabaseAdmin
              .from("calls")
              .update({ forward_answered_at: new Date().toISOString(), status: "bridged" })
              .eq("call_sid", aLeg.call_sid)
              .is("forward_answered_at", null);
            console.log("[telnyx-voice] PSTN forward leg answered → forward_answered_at set", {
              session: payload.call_session_id, bLeg: callControlId, aLeg: aLeg.call_sid, updErr: updErr?.message ?? null,
            });
          } else {
            const { error: updErr } = await supabaseAdmin
              .from("calls")
              .update({ browser_answered_at: new Date().toISOString() })
              .eq("call_session_id", payload.call_session_id)
              .is("browser_answered_at", null);
            console.log("[telnyx-voice] browser transfer leg answered → browser_answered_at set", {
              session: payload.call_session_id, bLeg: callControlId, updErr: updErr?.message ?? null,
            });
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (event === "call.recording.saved") {
      try {
        // Voicemail branch: only the explicitly tagged voicemail recording counts.
        // This avoids misclassifying auto-record stop events as voicemails.
        {
          const { data: vmCheck } = await supabaseAdmin
            .from("calls")
            .select("voicemail, voicemail_recording_id")
            .eq("call_sid", callControlId)
            .maybeSingle();
          const decoded = decodeClientState(payload?.client_state ?? body?.client_state);
          const taggedByState = decoded?.role === "voicemail_recording";
          const taggedById =
            typeof payload?.recording_id === "string" &&
            vmCheck?.voicemail_recording_id != null &&
            payload.recording_id === vmCheck.voicemail_recording_id;
          const isVoicemailRecording = (taggedById || taggedByState) && Boolean(vmCheck?.voicemail);
          console.log("[telnyx-voice] recording.saved classify", {
            callControlId,
            recording_id: payload?.recording_id ?? null,
            stored_vm_rec_id: vmCheck?.voicemail_recording_id ?? null,
            taggedById,
            taggedByState,
            isVoicemailRecording,
          });
          if (isVoicemailRecording) {
            const vmMp3: string | null =
              (typeof payload?.recording_urls?.mp3 === "string" ? payload.recording_urls.mp3 : null) ??
              (typeof payload?.recording_urls?.wav === "string" ? payload.recording_urls.wav : null);
            const vmStarted = payload?.recording_started_at ? new Date(payload.recording_started_at).getTime() : null;
            const vmEnded = payload?.recording_ended_at ? new Date(payload.recording_ended_at).getTime() : null;
            const vmDur = vmStarted && vmEnded ? Math.max(0, Math.round((vmEnded - vmStarted) / 1000)) : null;

            if (!callControlId || !vmMp3) {
              return NextResponse.json({ ok: true });
            }
            // Discard empty voicemails.
            if (vmDur !== null && vmDur < 1) {
              console.log("[telnyx-voice] empty voicemail (0s), discarding", { callControlId });
              await supabaseAdmin
                .from("calls")
                .update({ recording_state: "ready", status: "missed" })
                .eq("call_sid", callControlId);
              return NextResponse.json({ ok: true });
            }

            let vmBuf: ArrayBuffer | null = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                const resp = await fetch(vmMp3);
                if (resp.ok) { vmBuf = await resp.arrayBuffer(); break; }
              } catch (err) {
                console.warn(`[telnyx-voice] voicemail fetch attempt ${attempt} error`, err);
              }
              if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
            }
            if (!vmBuf) {
              console.error("[telnyx-voice] voicemail download failed");
              await supabaseAdmin.from("calls").update({ recording_state: "failed" }).eq("call_sid", callControlId);
              return NextResponse.json({ ok: true });
            }

            const vmNow = new Date();
            const vmYear = vmNow.getUTCFullYear();
            const vmMonth = String(vmNow.getUTCMonth() + 1).padStart(2, "0");
            const vmSafeId = callControlId.replace(/[^a-zA-Z0-9_-]/g, "_");
            const vmPath = `${vmYear}/${vmMonth}/${vmSafeId}.mp3`;

            const { error: vmUpErr } = await supabaseAdmin.storage
              .from("voicemails")
              .upload(vmPath, vmBuf, { contentType: "audio/mpeg", upsert: true });
            if (vmUpErr) {
              console.error("[telnyx-voice] voicemail upload failed", vmUpErr.message);
              await supabaseAdmin.from("calls").update({ recording_state: "failed" }).eq("call_sid", callControlId);
              return NextResponse.json({ ok: true });
            }

            await supabaseAdmin
              .from("calls")
              .update({
                voicemail_storage_path: vmPath,
                voicemail_duration_seconds: vmDur,
                status: "voicemail",
                recording_state: "ready",
              })
              .eq("call_sid", callControlId);
            console.log("[telnyx-voice] voicemail stored", { callControlId, vmPath });
            return NextResponse.json({ ok: true });
          }
        }

        const recId: string | null =
          (typeof payload?.recording_id === "string" ? payload.recording_id : null);
        const mp3: string | null =
          (typeof payload?.recording_urls?.mp3 === "string" ? payload.recording_urls.mp3 : null) ??
          (typeof payload?.recording_urls?.wav === "string" ? payload.recording_urls.wav : null);
        const startedAt = payload?.recording_started_at ? new Date(payload.recording_started_at).getTime() : null;
        const endedAt = payload?.recording_ended_at ? new Date(payload.recording_ended_at).getTime() : null;
        const recDur = startedAt && endedAt ? Math.max(0, Math.round((endedAt - startedAt) / 1000)) : null;

        if (!callControlId || !mp3) {
          console.log("[telnyx-voice] recording.saved missing id/url", { callControlId, hasMp3: !!mp3 });
          return NextResponse.json({ ok: true });
        }

        // Download from Telnyx with retries.
        let buf: ArrayBuffer | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const resp = await fetch(mp3);
            if (resp.ok) { buf = await resp.arrayBuffer(); break; }
            console.warn(`[telnyx-voice] recording fetch attempt ${attempt} status ${resp.status}`);
          } catch (err) {
            console.warn(`[telnyx-voice] recording fetch attempt ${attempt} error`, err);
          }
          if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
        }
        if (!buf) {
          console.error("[telnyx-voice] recording download failed; leaving state for retry");
          await supabaseAdmin.from("calls").update({ recording_state: "failed", telnyx_recording_id: recId }).eq("call_sid", callControlId);
          return NextResponse.json({ ok: true });
        }

        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, "0");
        const safeId = callControlId.replace(/[^a-zA-Z0-9_-]/g, "_");
        const path = `${year}/${month}/${safeId}.mp3`;

        const { error: upErr } = await supabaseAdmin.storage
          .from("call-recordings")
          .upload(path, buf, { contentType: "audio/mpeg", upsert: true });
        if (upErr) {
          console.error("[telnyx-voice] recording upload failed", upErr.message);
          await supabaseAdmin.from("calls").update({ recording_state: "failed", telnyx_recording_id: recId }).eq("call_sid", callControlId);
          return NextResponse.json({ ok: true });
        }

        // Private bucket: store the storage PATH (not a public URL).
        await supabaseAdmin
          .from("calls")
          .update({
            recording_url: path,
            recording_state: "ready",
            telnyx_recording_id: recId,
            recording_duration_seconds: recDur,
          })
          .eq("call_sid", callControlId);
        console.log("[telnyx-voice] recording stored", { callControlId, path });
      } catch (e) {
        console.error("[telnyx-voice] recording.saved handler failed", e);
      }
      return NextResponse.json({ ok: true });
    }

    if (event === "call.hangup") {
      callMap.delete(payload.call_session_id);
      try {
        if (callControlId) {
          const { data: callRow } = await supabaseAdmin
            .from("calls")
            .select("direction, answered_at, browser_answered_at, forward_answered_at, voicemail, voicemail_storage_path, status")
            .eq("call_sid", callControlId)
            .maybeSingle();
          const hangupCause = payload?.hangup_cause ?? null;

          if (callRow) {
            let finalStatus: string;
            if (callRow?.status === "voicemail" && callRow?.voicemail_storage_path) {
              // Real voicemail already stored — keep it.
              finalStatus = "voicemail";
            } else if (callRow?.voicemail && callRow?.voicemail_storage_path) {
              // Voicemail flow triggered AND a message was stored.
              finalStatus = "voicemail";
            } else if (callRow?.browser_answered_at) {
              finalStatus = "completed";
            } else if (callRow?.forward_answered_at) {
              finalStatus = "completed";
            } else if (callRow?.direction === "outbound" && callRow?.answered_at) {
              finalStatus = "completed";
            } else if (callRow?.voicemail && !callRow?.voicemail_storage_path) {
              // Voicemail flow started but NO message stored (silent decline / caller hung up
              // during greeting). This is a missed call, not a voicemail.
              finalStatus = "missed";
            } else if (hangupCause === "user_busy" || hangupCause === "busy") {
              finalStatus = "busy";
            } else if (callRow?.direction === "inbound") {
              finalStatus = "missed";
            } else {
              finalStatus = "no_answer";
            }

            console.log("[telnyx-voice] call.hangup status determination", {
              callControlId,
              direction: callRow?.direction ?? null,
              answered_at: callRow?.answered_at ?? null,
              browser_answered_at: callRow?.browser_answered_at ?? null,
              forward_answered_at: callRow?.forward_answered_at ?? null,
              voicemail: callRow?.voicemail ?? null,
              voicemail_storage_path: callRow?.voicemail_storage_path ?? null,
              prevStatus: callRow?.status ?? null,
              hangupCause,
              finalStatus,
            });

            const start = payload?.start_time ? new Date(payload.start_time).getTime() : null;
            const end = payload?.end_time ? new Date(payload.end_time).getTime() : Date.now();
            const dur = start ? Math.max(0, Math.round((end - start) / 1000)) : null;
            await supabaseAdmin
              .from("calls")
              .update({
                status: finalStatus,
                ended_at: new Date().toISOString(),
                duration: dur,
                duration_seconds: dur,
                hangup_cause: hangupCause,
                hangup_source: payload?.hangup_source ?? null,
              })
              .eq("call_sid", callControlId);
          } else {
            console.log("[telnyx-voice] call.hangup: no logged row for leg, skipping status update", { callControlId });
          }
        }
      } catch (e) {
        console.error("[telnyx-voice] call log hangup update failed", e);
      }

        if (callControlId && payload?.call_session_id) {
          const hangupCause = payload?.hangup_cause ?? null;
          const hangupSource = payload?.hangup_source ?? null;

          const { data: selfRow } = await supabaseAdmin
            .from("calls")
            .select("call_sid")
            .eq("call_sid", callControlId)
            .maybeSingle();

          if (!selfRow) {
            const decoded = decodeClientState(payload?.client_state ?? body?.client_state);
            const role = decoded?.role ?? null;
            const isBrowserTransferLeg = role === "browser_transfer";
            const isForwardTransferLeg = role === "forward_transfer";
            const declineCauses = new Set(["call_rejected", "user_busy", "busy", "decline", "rejected"]);
            const isDecline = hangupCause != null && declineCauses.has(hangupCause);
            const isTimeout = hangupCause === "timeout" || hangupCause === "no_answer";
            const isUnanswered = isDecline || isTimeout;

            const { data: aRow } = await supabaseAdmin
              .from("calls")
              .select("call_sid, to_number, voicemail, ended_at, browser_answered_at, forward_answered_at, direction, routing_mode")
              .eq("call_session_id", payload.call_session_id)
              .neq("call_sid", callControlId)
              .maybeSingle();

            console.log("[telnyx-voice] B-leg hangup eval", {
              bLeg: callControlId, aLeg: aRow?.call_sid ?? null,
              role, hangupCause, hangupSource, isDecline, isTimeout,
              browser_answered_at: aRow?.browser_answered_at ?? null,
              forward_answered_at: aRow?.forward_answered_at ?? null,
              routing_mode: aRow?.routing_mode ?? null,
              voicemail: aRow?.voicemail ?? null, ended_at: aRow?.ended_at ?? null,
            });

            const aLiveInbound =
              aRow?.call_sid &&
              aRow.direction === "inbound" &&
              !aRow.browser_answered_at &&
              !aRow.forward_answered_at &&
              !aRow.voicemail &&
              !aRow.ended_at;

            if (isBrowserTransferLeg && isUnanswered && aLiveInbound) {
              if (aRow.routing_mode === "browser_first_then_forward") {
                const routing = await getRoutingConfig(aRow.to_number ?? "");
                if (routing.forwardingNumber) {
                  console.log("[telnyx-voice] browser timeout → forwarding number", {
                    aLeg: aRow.call_sid, fwd: routing.forwardingNumber,
                  });
                  const fwdState = Buffer.from(JSON.stringify({ role: "forward_transfer" })).toString("base64");
                  const ok = await safeTransfer(aRow.call_sid, routing.forwardingNumber, aRow.to_number ?? null, FORWARD_RING_TIMEOUT_SECONDS, fwdState);
                  if (ok) {
                    await supabaseAdmin.from("calls").update({
                      forwarded_to: routing.forwardingNumber,
                      forwarded_at: new Date().toISOString(),
                      status: "ringing",
                    }).eq("call_sid", aRow.call_sid);
                  } else {
                    const vm = await startVoicemail(aRow.call_sid, aRow.to_number ?? null);
                    console.log("[telnyx-voice] forward-after-browser failed → voicemail", vm);
                  }
                } else {
                  const vm = await startVoicemail(aRow.call_sid, aRow.to_number ?? null);
                  console.log("[telnyx-voice] browser_first_then_forward but no fwd number → voicemail", vm);
                }
              } else {
                const vm = await startVoicemail(aRow.call_sid, aRow.to_number ?? null);
                console.log("[telnyx-voice] browser_only unanswered → voicemail", vm);
              }
            } else if (isForwardTransferLeg && isUnanswered && aLiveInbound) {
              const vm = await startVoicemail(aRow.call_sid, aRow.to_number ?? null);
              console.log("[telnyx-voice] forward unanswered → voicemail", vm);
            }
          }
        }
    }

    if (event === "call.playback.ended") {
      try {
        if (callControlId) {
          const { data: vmRow } = await supabaseAdmin
            .from("calls")
            .select("call_sid, voicemail, voicemail_storage_path, recording_state, voicemail_recording_id")
            .eq("call_sid", callControlId)
            .maybeSingle();
          // Only react for voicemail calls that haven't started recording yet.
          if (vmRow?.voicemail && !vmRow.voicemail_storage_path && vmRow.recording_state !== "recording") {
            const rec = await startRecording(callControlId, {
              play_beep: true,
              clientState: Buffer.from(JSON.stringify({ role: "voicemail_recording" })).toString("base64"),
            });
            if (rec.ok) {
              const vmRecId = rec.data?.data?.recording_id ?? null;
              await supabaseAdmin
                .from("calls")
                .update({ recording_state: "recording", voicemail_recording_id: vmRecId })
                .eq("call_sid", callControlId);
              console.log("[telnyx-voice] voicemail beep-record started", { callControlId, vmRecId });
            } else {
              console.error("[telnyx-voice] voicemail record_start failed", rec.error);
            }
          }
        }
      } catch (e) {
        console.error("[telnyx-voice] playback.ended handler failed", e);
      }
      return NextResponse.json({ ok: true });
    }

    if (event === "call.speak.ended") {
      await hangup(callControlId);
    }

  } catch (error) {
    console.error("webhook error", error);
  }

  return NextResponse.json({ ok: true });
}
