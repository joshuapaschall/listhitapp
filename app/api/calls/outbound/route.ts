import { NextResponse } from "next/server";

import { Buffer } from "node:buffer";

import { requireAgent } from "@/lib/agent-auth";
import { formatPhoneE164 } from "@/lib/call-validation";
import {
  TELNYX_API_URL,
  TELNYX_DEBUG,
  getCallControlAppId,
  getSipCredentialConnectionId,
  getTelnyxApiKey,
} from "@/lib/voice-env";

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

async function preflightSipConnection(id: string, apiKey: string) {
  try {
    const response = await fetch(`${TELNYX_API_URL}/connections/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = response.ok ? await response.json() : null;
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    console.warn("[outbound] failed to preflight SIP connection", id, error);
    return { ok: false, status: 0, data: null };
  }
}

async function preflightVoiceApp(appId: string, apiKey: string) {
  try {
    const r = await fetch(`${TELNYX_API_URL}/call_control_applications/${appId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const j = await r.json().catch(() => ({}));
    const ovp = j?.data?.outbound?.outbound_voice_profile_id;
    const webhook = j?.data?.webhook_url;
    if (TELNYX_DEBUG) {
      console.log("[preflight app]", { ok: r.ok, status: r.status, ovp, webhook, appId });
    }
    if (!r.ok || !ovp || !webhook) {
      console.warn("[outbound] app misconfigured", { appId, status: r.status, ovp, webhook });
    }
  } catch (error) {
    console.warn("[outbound] failed to preflight call control app", { appId, error });
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = getTelnyxApiKey();
    const appId = getCallControlAppId();
    const sipConnectionId = getSipCredentialConnectionId();
    const fallbackFrom = process.env.FROM_NUMBER || "";

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing TELNYX_API_KEY" },
        { status: 500 },
      );
    }

    if (!appId) {
      return NextResponse.json(
        { ok: false, error: "Missing CALL_CONTROL_APP_ID" },
        { status: 500 },
      );
    }

    if (!sipConnectionId) {
      return NextResponse.json(
        { ok: false, error: "Missing SIP connection id" },
        { status: 500 },
      );
    }

    const agent = await requireAgent();

    if (!agent?.sip_username) {
      return NextResponse.json(
        { ok: false, error: "Agent missing SIP username" },
        { status: 400 },
      );
    }

    await preflightVoiceApp(appId, apiKey);

    const body = await req.json().catch(() => ({}));

    const toNormalized = formatPhoneE164(body?.to || "");
    if (!toNormalized) {
      return NextResponse.json(
        { ok: false, error: "Invalid destination" },
        { status: 400 },
      );
    }

    const selectedFrom = body?.from as string | undefined;
    const fromCandidate = selectedFrom || fallbackFrom;
    const fromE164 = formatPhoneE164(fromCandidate || "");
    if (!fromE164) {
      return NextResponse.json(
        { ok: false, error: "Missing valid FROM_NUMBER" },
        { status: 400 },
      );
    }

    const fromCheckUrl = new URL("/api/diag/telnyx/from-check", req.url);
    fromCheckUrl.searchParams.set("n", fromE164);
    const fromCheckResponse = await fetch(fromCheckUrl.toString(), { cache: "no-store" }).catch(() => null);
    const fromCheckJson = (await fromCheckResponse?.json().catch(() => null)) as
      | {
          assigned_to_app?: boolean;
          assigned_to_sip?: boolean;
          assigned_to_origin?: boolean;
          verified_caller_id?: boolean;
        }
      | null;
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>,",fromCheckJson)
    const assignedToApp = Boolean(fromCheckJson?.assigned_to_app);
    const assignedToSip = Boolean(fromCheckJson?.assigned_to_sip);
    const assignedToOrigin = Boolean(fromCheckJson?.assigned_to_origin);
    const verifiedCallerId = Boolean(fromCheckJson?.verified_caller_id);

    // if (!assignedToApp && !verifiedCallerId) {
    //   return NextResponse.json(
    //     {
    //       ok: false,
    //       error: "Selected From must be assigned to the Voice API app or verified in Telnyx.",
    //     },
    //     { status: 400 },
    //   );
    // }

    const clientState = Buffer.from(
      JSON.stringify({ dest: toNormalized, from: fromE164 }),
      "utf8",
    ).toString("base64");

    const payload = {
      to: `sip:${agent.sip_username}@sip.telnyx.com`,
      from: fromE164,
      connection_id: appId,
      client_state: clientState,
    };

    const sipCheck = await preflightSipConnection(sipConnectionId, apiKey);
    const hasOutboundVoiceProfile = !!sipCheck?.data?.data?.outbound_voice_profile_id;
    if (!hasOutboundVoiceProfile) {
      console.warn("[outbound] SIP connection has no outbound_voice_profile_id", {
        sip_id: sipConnectionId,
        status: sipCheck?.status,
      });
    }

    console.log("[outbound] dialing", {
      app_id: appId,
      sip_id: sipConnectionId,
      from: fromE164,
      dest: toNormalized,
      assigned_to_app: assignedToApp,
      assigned_to_sip: assignedToSip,
      assigned_to_origin: assignedToOrigin,
    });

    const response = await fetch(`${TELNYX_API_URL}/calls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (!response.ok) {
      const errorMessage =
        json?.errors?.[0]?.detail ||
        json?.message ||
        `Telnyx call failed with status ${response.status}`;
      console.error("[outbound] call failed", {
        status: response.status,
        body: text,
        payload,
      });
      return NextResponse.json({ ok: false, error: errorMessage }, { status: 502 });
    }

    return NextResponse.json({ ok: true, data: json });
  } catch (error) {
    console.error("[outbound] unexpected error", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
