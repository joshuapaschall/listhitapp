import { NextResponse } from "next/server";
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx";

const HOLD_ACTION = "hold";
const UNHOLD_ACTION = "unhold";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({} as any));
  const { hold, action } = body || {};
  const id = params.id;

  if (!id) {
    return NextResponse.json(
      { error: "Missing session id" },
      { status: 400 },
    );
  }

  const callMap = global.callMap || (global.callMap = new Map());
  const callControlId = callMap.get(id) || id;

  if (!callControlId) {
    return NextResponse.json(
      { error: "Call control ID not found" },
      { status: 400 },
    );
  }

  const holdAction: string = action || (hold ? HOLD_ACTION : UNHOLD_ACTION);
  const holdMusicUrl =
    process.env.HOLD_MUSIC_URL ||
    (process.env.DISPOTOOL_BASE_URL
      ? `${process.env.DISPOTOOL_BASE_URL}/sounds/on-hold.mp3`
      : null);

  try {
    if (holdAction === HOLD_ACTION) {
      const holdResponse = await fetch(`${TELNYX_API_URL}/calls/${callControlId}/actions/hold`, {
        method: "POST",
        headers: telnyxHeaders(),
      });

      if (!holdResponse.ok) {
        const error = await holdResponse.json().catch(() => ({}));
        return NextResponse.json(error, { status: holdResponse.status });
      }

      if (holdMusicUrl) {
        const playbackResponse = await fetch(
          `${TELNYX_API_URL}/calls/${callControlId}/actions/playback_start`,
          {
            method: "POST",
            headers: telnyxHeaders(),
            body: JSON.stringify({
              audio_url: holdMusicUrl,
              loop: "infinity",
              target_legs: "opposite",
            }),
          },
        );

        if (!playbackResponse.ok) {
          const error = await playbackResponse.json().catch(() => ({}));
          return NextResponse.json(error, { status: playbackResponse.status });
        }
      }

      return NextResponse.json({ status: "held" }, { status: 200 });
    }

    const stopPlayback = await fetch(`${TELNYX_API_URL}/calls/${callControlId}/actions/playback_stop`, {
      method: "POST",
      headers: telnyxHeaders(),
    });

    if (!stopPlayback.ok) {
      const error = await stopPlayback.json().catch(() => ({}));
      return NextResponse.json(error, { status: stopPlayback.status });
    }

    const unholdResponse = await fetch(`${TELNYX_API_URL}/calls/${callControlId}/actions/unhold`, {
      method: "POST",
      headers: telnyxHeaders(),
    });

    if (!unholdResponse.ok) {
      const error = await unholdResponse.json().catch(() => ({}));
      return NextResponse.json(error, { status: unholdResponse.status });
    }

    return NextResponse.json({ status: "resumed" }, { status: 200 });
  } catch (error) {
    console.error("❌ Hold/unhold API error:", error);
    return NextResponse.json(
      { error: "Failed to update hold state" },
      { status: 500 },
    );
  }
}
