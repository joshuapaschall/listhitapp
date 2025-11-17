import { NextResponse } from "next/server"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({} as any))
  const { hold } = body || {}
  const id = params.id

  if (!id)
    return NextResponse.json(
      { error: "Missing session id" },
      { status: 400 }
    )
  const callMap = global.callMap || (global.callMap = new Map());
  const callControlId = callMap.get(id);

  if (hold) {
    const r = await fetch(`${TELNYX_API_URL}/calls/${callControlId}/actions/playback_start`, {
      method: "POST",
      headers: telnyxHeaders(),
      body: JSON.stringify({
        audio_url: process.env.DISPOTOOL_BASE_URL +"/sounds/on-hold.mp3",
        "loop": "infinity",
        target_legs:"both"
      }),
    })
    const d = await r.json().catch(() => ({}))
    return NextResponse.json(d, { status: r.status })
  } else {
    const r = await fetch(`${TELNYX_API_URL}/calls/${callControlId}/actions/playback_stop`, {
      method: "POST",
      headers: telnyxHeaders(),
    })
    const d = await r.json().catch(() => ({}))
    return NextResponse.json(d, { status: r.status })
  }
}
