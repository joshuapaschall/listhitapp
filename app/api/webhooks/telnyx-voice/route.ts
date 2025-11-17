import { Buffer } from "node:buffer";

import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { formatPhoneE164 } from "@/lib/call-validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
  const body: any = { to };
  // if (fromE164) body.from = fromE164;
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
  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("id,sip_username")
    .eq("status", "available")
    .limit(1)
    .single()

  if (error) {
    console.error("Failed to fetch available agent", error);
    return null;
  }

  if (!agent) {
    return null;
  }

  return agent;
}

async function getAgentBySipUsername(sip_username: string): Promise<{ id: string, sip_username: string } | null> {
  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("id,sip_username")
    .eq("sip_username", sip_username)
    .limit(1)
    .single()

  if (error) {
    console.error("Failed to fetch available agent", error);
    return null;
  }

  if (!agent) {
    return null;
  }

  return agent;
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

      if (direction === "incoming") {
        await answer(callControlId);
        return NextResponse.json({ ok: true });
      }

      if (direction === "outgoing") {
        return NextResponse.json({ ok: true });
      }
    }

    if (event === "call.answered") {

      if (await resolveOrgFromDid(payload?.to)) {
        const agent = await pickAvailableAgent();
        if (agent) {
          await transfer(
            callControlId,
            buildSipUri(agent?.sip_username)!,
            ""
          );
          const recordId = uuidv4()
          const { data, error } = await supabaseAdmin
            .from("agent_active_calls")
            .upsert(
              {
                id: recordId,
                agent_id: agent?.id,
                customer_leg_id: callControlId,
                hold_state: "active",
                playback_state: "idle",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'agent_id',
                ignoreDuplicates: false,
              },
            )
            .select()
            .single()

          if (error) throw error

          console.log("✅ Active call record created:", data)
          console.log("Call Transfer Successfully.")
        } else {
          await speak(callControlId, "Sorry, we couldn’t reach an agent right now. We’ll call you back shortly.")
        }

      } else {
        const client_state = decodeClientState(payload?.client_state);
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>", client_state)
        if (client_state?.to) {
          const agent = await getAgentBySipUsername(client_state?.to);
          if (agent) {
            const recordId = uuidv4()
            const { data, error } = await supabaseAdmin
              .from("agent_active_calls")
              .upsert(
                {
                  id: recordId,
                  agent_id: agent?.id,
                  customer_leg_id: callControlId,
                  hold_state: "active",
                  playback_state: "idle",
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: 'agent_id',
                  ignoreDuplicates: false,
                },
              )
              .select()
              .single()

            if (error) throw error

            console.log("✅ Active call record created:", data)
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (event === "call.hangup") {
      callMap.delete(payload.call_session_id);
    }

    if (event === "call.speak.ended") {
      await hangup(callControlId);
    }

  } catch (error) {
    console.error("webhook error", error);
  }

  return NextResponse.json({ ok: true });
}
