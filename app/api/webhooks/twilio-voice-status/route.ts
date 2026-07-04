import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"

import { assertServer } from "@/utils/assert-server"
import { supabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

assertServer()

// Full public URL Twilio signed against — includes the ?ref=… query (conference
// model), so signature validation must match it exactly.
function fullCallbackUrl(url: URL): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  return `${base}${url.pathname}${url.search}`
}

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody).entries())

  const authToken = process.env.LISTHIT_TWILIO_AUTH_TOKEN
  if (!authToken) {
    console.error("[twilio-voice-status] LISTHIT_TWILIO_AUTH_TOKEN is not set; rejecting webhook")
    return new NextResponse("Forbidden", { status: 403 })
  }
  const url = new URL(request.url)
  const ref = url.searchParams.get("ref")
  const signature = request.headers.get("x-twilio-signature") || ""
  if (!twilio.validateRequest(authToken, signature, fullCallbackUrl(url), params)) {
    return new NextResponse("Invalid signature", { status: 403 })
  }

  const callSid = params.CallSid
  const parentCallSid = params.ParentCallSid
  const callStatus = params.CallStatus
  const callDuration = params.CallDuration

  // Correlate to the call-log row. The prospect leg's callback (conference model)
  // carries ?ref=<agentCallSid>; prefer it. Keep ParentCallSid/CallSid fallbacks so
  // any lingering direct-dial callback still resolves. Far-leg capture is now done
  // at dial time in the TwiML webhook, so it is intentionally not repeated here.
  const matchSid = ref || parentCallSid || callSid
  if (!matchSid || !callStatus) {
    return new NextResponse("Missing params", { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from("calls")
    .select("id, answered_at")
    .eq("call_sid", matchSid)
    .maybeSingle()

  if (!existing) {
    console.warn("[twilio-voice-status] no matching calls row", { matchSid, callStatus })
    return new NextResponse(null, { status: 204 })
  }

  const now = new Date().toISOString()
  const updates: Record<string, any> = { status: callStatus }

  switch (callStatus) {
    case "in-progress":
      updates.answered_at = existing.answered_at ?? now
      break
    case "completed":
      updates.duration = Number(callDuration) || null
      updates.ended_at = now
      break
    case "busy":
    case "failed":
    case "no-answer":
    case "canceled":
      updates.hangup_cause = callStatus
      updates.ended_at = now
      break
    default:
      // initiated / ringing / queued — status only.
      break
  }

  const { error } = await supabaseAdmin.from("calls").update(updates).eq("id", existing.id)
  if (error) {
    console.error("[twilio-voice-status] update failed", { matchSid, error })
    return new NextResponse("Error", { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
