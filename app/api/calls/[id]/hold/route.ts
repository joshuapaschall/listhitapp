import { NextResponse } from "next/server";
import { playAudioUrl, stopPlayback } from "@/lib/voice/call-control";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Resolve the live PSTN call_control_id for this call. Prefer the id the client
// passed (it is usually the far leg), but verify it maps to a live `calls` row;
// otherwise fall back to the most-recent live call. This mirrors SendText's
// hold route, which never trusts a raw client id.
async function resolveLiveCallControlId(passedId: string): Promise<string | null> {
  const LIVE = ["initiated", "answered"];
  // 1) Trust the passed id if it matches a live row by call_sid.
  if (passedId) {
    const { data } = await supabaseAdmin
      .from("calls")
      .select("call_sid, status")
      .eq("call_sid", passedId)
      .in("status", LIVE)
      .maybeSingle();
    if (data?.call_sid) return data.call_sid;
  }
  // 2) Fallback: most-recent live call of either direction.
  const { data } = await supabaseAdmin
    .from("calls")
    .select("call_sid, status, started_at")
    .in("status", LIVE)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.call_sid ?? null;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const passedId = params.id;
  const body = await req.json().catch(() => ({} as any));
  const action = body?.action === "unhold" ? "unhold" : "hold";

  const legId = await resolveLiveCallControlId(passedId);
  console.log("[hold-api] resolve", { passedId, resolvedLegId: legId, action });

  if (!legId) {
    return NextResponse.json({ ok: false, error: "No live call leg found for hold" }, { status: 404 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const holdMusicUrl = base ? `${base}/sounds/on-hold.mp3` : "";

  try {
    if (action === "hold") {
      if (!holdMusicUrl) {
        return NextResponse.json({ ok: false, error: "Hold music URL not configured (NEXT_PUBLIC_BASE_URL)" }, { status: 500 });
      }
      const r = await playAudioUrl(legId, holdMusicUrl, true, "self");
      console.log("[hold-api] playback_start result", { legId, holdMusicUrl, ok: r.ok, error: r.ok ? null : r.error });
      return r.ok
        ? NextResponse.json({ ok: true, data: r.data })
        : NextResponse.json({ ok: false, error: r.error }, { status: 502 });
    } else {
      const r = await stopPlayback(legId);
      console.log("[hold-api] playback_stop result", { legId, ok: r.ok, error: r.ok ? null : r.error });
      return r.ok
        ? NextResponse.json({ ok: true, data: r.data })
        : NextResponse.json({ ok: false, error: r.error }, { status: 502 });
    }
  } catch (e: any) {
    console.error("[hold-api] exception", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "Hold failed" }, { status: 500 });
  }
}
