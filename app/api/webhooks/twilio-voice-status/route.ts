import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"

import { assertServer } from "@/utils/assert-server"
import { supabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

assertServer()

// Public URL Twilio signs against — must match the <Number statusCallback=…> set by
// the TwiML webhook.
function callbackUrl(): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  return `${base}/api/webhooks/twilio-voice-status`
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
  const signature = request.headers.get("x-twilio-signature") || ""
  if (!twilio.validateRequest(authToken, signature, callbackUrl(), params)) {
    return new NextResponse("Invalid signature", { status: 403 })
  }

  const callSid = params.CallSid
  const parentCallSid = params.ParentCallSid
  const callStatus = params.CallStatus
  const callDuration = params.CallDuration

  // The call-log row is keyed on the parent (browser) leg CallSid inserted by the
  // TwiML webhook. The status callback fires on the child (PSTN) leg, so prefer
  // ParentCallSid; fall back to CallSid.
  const matchSid = parentCallSid || callSid
  if (!matchSid || !callStatus) {
    return new NextResponse("Missing params", { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from("calls")
    .select("id, answered_at, far_leg_sid")
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

  // Far-leg capture (V3d): a callback carrying ParentCallSid is the child (far
  // party) leg of an outbound <Dial>. Record its CallSid once so a cold transfer
  // can redirect the far party. Guarded — never overwrite a captured SID.
  if (parentCallSid && !existing.far_leg_sid) {
    updates.far_leg_sid = callSid
  }

  const { error } = await supabaseAdmin.from("calls").update(updates).eq("id", existing.id)
  if (error) {
    console.error("[twilio-voice-status] update failed", { matchSid, error })
    return new NextResponse("Error", { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
