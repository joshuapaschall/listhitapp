import { NextResponse } from "next/server";

import { TELNYX_API_URL, getCallControlAppId, getTelnyxApiKey } from "@/lib/voice-env";

export async function GET() {
  const id = getCallControlAppId();
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "No CALL_CONTROL_APP_ID" },
      { status: 500 },
    );
  }

  const apiKey = getTelnyxApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Missing TELNYX_API_KEY" },
      { status: 500 },
    );
  }

  const response = await fetch(`${TELNYX_API_URL}/call_control_applications/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await response.json().catch(() => ({}));
  const outbound = data?.data?.outbound ?? null;
  const outboundVoiceProfileId =
    (outbound && typeof outbound === "object"
      ? (outbound as Record<string, any>).outbound_voice_profile_id
      : null) ?? null;

  return NextResponse.json({
    ok: response.ok,
    status: response.status,
    data: data?.data ?? data ?? null,
    webhook_url: data?.data?.webhook_url ?? null,
    webhook_failover_url: data?.data?.webhook_failover_url ?? null,
    outbound_voice_profile_id: outboundVoiceProfileId,
  });
}
