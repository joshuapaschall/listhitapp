import { Buffer } from "node:buffer";

import { NextResponse } from "next/server";
import { formatPhoneE164 } from "@/lib/call-validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getWebRTCSipUri } from "@/lib/voice/webrtc-sip";
import { bridgeCall } from "@/lib/voice/call-control";
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
  fromE164?: string | null
) {
  const body: any = { to, timeout_secs: 30 };
  if (fromE164) body.from = fromE164;
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

export async function POST(req: Request) {
  let body: TelnyxEventPayload | null = null;

  try {
    body = (await req.json()) as TelnyxEventPayload;
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
            .from("buyers").select("id").or(orFilter).limit(1).maybeSingle();
          buyerId = b?.id ?? null;
        }
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
            },
            { onConflict: "call_sid" }
          );
        }
      } catch (e) {
        console.error("[telnyx-voice] call log insert failed", e);
      }

      if (direction === "incoming") {
        await answer(callControlId);
        const sipUri = await getWebRTCSipUri();

        if (sipUri) {
          // A SIP-URI transfer spins up a new outbound leg that REQUIRES a `from`
          // caller ID. For an in-Telnyx SIP transfer the `from` is metadata for the
          // WebRTC client's caller-ID display and need NOT be a number on the
          // account — but omitting it makes Telnyx reject with 10010/D11
          // "Destination Number is invalid". Pass the original caller's number.
          await transfer(callControlId, sipUri, payload.from);
        } else {
          await sayAndHangup(
            callControlId,
            "Sorry, no agent is available right now. Please try again later."
          );
        }

        return NextResponse.json({ ok: true });
      }

      if (direction === "outgoing") {
        return NextResponse.json({ ok: true });
      }
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
      return NextResponse.json({ ok: true });
    }

    if (event === "call.hangup") {
      callMap.delete(payload.call_session_id);
      try {
        if (callControlId) {
          const start = payload?.start_time ? new Date(payload.start_time).getTime() : null;
          const end = payload?.end_time ? new Date(payload.end_time).getTime() : Date.now();
          const dur = start ? Math.max(0, Math.round((end - start) / 1000)) : null;
          await supabaseAdmin
            .from("calls")
            .update({
              status: "completed",
              ended_at: new Date().toISOString(),
              duration: dur,
              duration_seconds: dur,
              hangup_cause: payload?.hangup_cause ?? null,
              hangup_source: payload?.hangup_source ?? null,
            })
            .eq("call_sid", callControlId);
        }
      } catch (e) {
        console.error("[telnyx-voice] call log hangup update failed", e);
      }
    }

    if (event === "call.speak.ended") {
      await hangup(callControlId);
    }

  } catch (error) {
    console.error("webhook error", error);
  }

  return NextResponse.json({ ok: true });
}
