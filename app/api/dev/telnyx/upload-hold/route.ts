// app/api/dev/telnyx/upload-hold/route.ts
import { NextResponse } from "next/server";

import { TELNYX_API_URL, getTelnyxApiKey } from "@/lib/voice-env";

export async function POST(req: Request) {
  try {
    const { mediaUrl, name } = await req.json().catch(() => ({}));
    const publicUrl = mediaUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/sounds/on-hold.mp3`;
    const mediaName = name || "hold-music";
    const apiKey = getTelnyxApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "Missing TELNYX_API_KEY" }, { status: 500 });
    }

    const r = await fetch(`${TELNYX_API_URL}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        media_url: publicUrl,
        ttl_secs: 630720000, // ~20 years
        media_name: mediaName,
      }),
    });

    const body = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ status: r.status, body }, { status: r.status });

    const download = `${TELNYX_API_URL}/media/${mediaName}/download`;
    return NextResponse.json({ status: r.status, body, download }, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown" }, { status: 500 });
  }
}
