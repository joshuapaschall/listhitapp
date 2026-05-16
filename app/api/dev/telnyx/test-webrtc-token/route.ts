// app/api/dev/telnyx/test-webrtc-token/route.ts
import { NextResponse } from "next/server";

import { TELNYX_API_URL, getCallControlAppId, getTelnyxApiKey } from "@/lib/voice-env";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "")
  if (!token || token !== process.env.ADMIN_TASKS_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const url = new URL(request.url);
    const sip = url.searchParams.get("sip"); // e.g. ?sip=myagentuser
    if (!sip) return NextResponse.json({ error: "Missing ?sip=" }, { status: 400 });

    const apiKey = getTelnyxApiKey();
    const appId = getCallControlAppId();
    if (!apiKey || !appId) {
      return NextResponse.json({ error: "Telnyx not configured" }, { status: 500 });
    }

    const r = await fetch(`${TELNYX_API_URL}/webrtc/tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sip_username: sip, application_id: appId }),
    });

    const body = await r.json().catch(() => ({}));
    return NextResponse.json({ status: r.status, body }, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown" }, { status: 500 });
  }
}
