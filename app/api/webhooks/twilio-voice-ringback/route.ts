import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
}

// TwiML played on the outbound conference's waitUrl. While the prospect leg is
// being dialed into the room the lone agent would otherwise hear Twilio's default
// conference hold music; instead loop a ringback tone so it sounds like a normal
// outbound call ringing. Reuses the ringtone already shipped under public/sounds
// (no new binary). loop="0" repeats until the prospect joins and the conference
// starts. Falls back to silence if the base URL isn't configured.
export function GET(): NextResponse {
  const base = baseUrl()
  const twiml = base
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Play loop="0">${base}/sounds/outbound-ringtone.mp3</Play></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="60"/></Response>`
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } })
}
