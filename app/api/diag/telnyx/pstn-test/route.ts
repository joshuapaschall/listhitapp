import { NextResponse } from "next/server";

import { TELNYX_API_URL, getCallControlAppId, getTelnyxApiKey } from "@/lib/voice-env";

const normalizeE164 = (value?: string) => {
  const raw = (value || "").replace(/[^\d+]/g, "");
  if (!/^\+?[1-9]\d{6,15}$/.test(raw)) {
    return "";
  }
  return raw.startsWith("+") ? raw : `+${raw}`;
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const to = normalizeE164(body?.to);
  const from = normalizeE164(body?.from ?? process.env.FROM_NUMBER);
  const appId = getCallControlAppId();
  const apiKey = getTelnyxApiKey();

  if (!to || !from || !appId || !apiKey) {
    return NextResponse.json(
      { ok: false, error: "Need to, from, CALL_CONTROL_APP_ID, and TELNYX_API_KEY" },
      { status: 400 },
    );
  }

  const payload = { to, from, connection_id: appId };
  const response = await fetch(`${TELNYX_API_URL}/calls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const telnyx = await response.json().catch(() => ({}));

  return NextResponse.json({
    ok: response.ok,
    status: response.status,
    telnyx,
    sent: payload,
  });
}
