import { NextResponse } from "next/server";
import { playAudioUrl, stopPlayback } from "@/lib/voice/call-control";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const callControlId = params.id;
  if (!callControlId) {
    return NextResponse.json({ ok: false, error: "Missing call control id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({} as any));
  const action = body?.action === "unhold" ? "unhold" : "hold";

  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const holdMusicUrl = base ? `${base}/sounds/on-hold.mp3` : "";

  try {
    if (action === "hold") {
      if (!holdMusicUrl) {
        return NextResponse.json({ ok: false, error: "Hold music URL not configured (NEXT_PUBLIC_BASE_URL)" }, { status: 500 });
      }
      // Play to the far leg's own audio ("self" relative to this leg id) so the
      // caller hears hold music. loop=true for continuous playback.
      const r = await playAudioUrl(callControlId, holdMusicUrl, true, "self");
      return r.ok
        ? NextResponse.json({ ok: true, data: r.data })
        : NextResponse.json({ ok: false, error: r.error }, { status: 502 });
    } else {
      const r = await stopPlayback(callControlId);
      return r.ok
        ? NextResponse.json({ ok: true, data: r.data })
        : NextResponse.json({ ok: false, error: r.error }, { status: 502 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Hold failed" }, { status: 500 });
  }
}
