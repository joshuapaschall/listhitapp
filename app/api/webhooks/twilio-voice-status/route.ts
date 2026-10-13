import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"

import { assertServer } from "@/utils/assert-server"
import { supabaseAdmin } from "@/lib/supabase"
import { getVoicemailGreetingUrl } from "@/lib/voice/routing"
import { appendVoicemailTwiml } from "@/lib/voice/twilio-voicemail"
import { getTwilioClientForOrg } from "@/lib/twilio/org-client"
import { verifyTwilioWebhook } from "@/lib/twilio/verify-webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

assertServer()

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
}

// Full public URL Twilio signed against — includes the FULL ?ref=…&role=… query, so
// signature verification must match it exactly.
function fullCallbackUrl(url: URL): string {
  return `${baseUrl()}${url.pathname}${url.search}`
}

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody).entries())

  const url = new URL(request.url)
  const ref = url.searchParams.get("ref")
  const role = url.searchParams.get("role")
  const verified = await verifyTwilioWebhook({
    signature: request.headers.get("x-twilio-signature") || "",
    url: fullCallbackUrl(url),
    params,
  })
  if (!verified.ok) {
    console.warn("[twilio-voice-status] rejected webhook", { reason: verified.reason })
    return new NextResponse("Forbidden", { status: 403 })
  }

  // The verified subaccount's org is the authority; a call row from another org
  // is never touched.
  const orgMismatch = (rowOrgId: string | null | undefined) => {
    if (verified.orgId && rowOrgId && rowOrgId !== verified.orgId) {
      console.warn("[twilio-webhook] org mismatch", { route: "twilio-voice-status" })
      return true
    }
    return false
  }

  const callSid = params.CallSid
  const parentCallSid = params.ParentCallSid
  const callStatus = params.CallStatus
  const callDuration = params.CallDuration

  // Inbound agent leg (C1b): each dialed-in agent reports here with ?ref=<callerCallSid>
  // &role=agent. These callbacks drive the no-answer counter — they are NOT the call
  // itself, so we never write the agent leg's own status onto the call row.
  if (role === "agent") {
    if (!ref || !callStatus) return new NextResponse("Missing params", { status: 400 })

    const { data: refRow } = await supabaseAdmin
      .from("calls")
      .select("org_id")
      .eq("call_sid", ref)
      .maybeSingle()
    if (orgMismatch(refRow?.org_id)) return new NextResponse("Forbidden", { status: 403 })

    // An agent answered → mark the call answered.
    if (callStatus === "in-progress") {
      const { data: crow } = await supabaseAdmin
        .from("calls")
        .select("answered_at")
        .eq("call_sid", ref)
        .maybeSingle()
      await supabaseAdmin
        .from("calls")
        .update({
          agent_answered: true,
          answered_at: crow?.answered_at ?? new Date().toISOString(),
          status: "in-progress",
        })
        .eq("call_sid", ref)
      return new NextResponse(null, { status: 204 })
    }

    // An agent leg ended. Atomically decrement the outstanding counter; when the LAST
    // leg ends and nobody answered, redirect the still-waiting caller to voicemail.
    if (["no-answer", "busy", "failed", "canceled", "completed"].includes(callStatus)) {
      const { data: rpc } = await supabaseAdmin.rpc("note_twilio_agent_leg_ended", { p_call_sid: ref })
      const result = Array.isArray(rpc) ? rpc[0] : rpc
      if (result && result.remaining === 0 && result.answered === false) {
        const { data: crow } = await supabaseAdmin
          .from("calls")
          .select("to_number, status, org_id")
          .eq("call_sid", ref)
          .maybeSingle()
        if (crow && crow.status !== "voicemail") {
          const greetingUrl = await getVoicemailGreetingUrl(crow.to_number)
          const vr = new twilio.twiml.VoiceResponse()
          appendVoicemailTwiml(vr, {
            greetingUrl,
            recordingStatusCallback: `${baseUrl()}/api/webhooks/twilio-voicemail-recording`,
          })
          try {
            // Verified subaccount org; the call row's org only for parent-account calls.
            const clientOrgId = verified.orgId ?? (verified.account === "parent" ? crow.org_id : null)
            if (!clientOrgId) throw new Error("No org for the voicemail redirect")
            const client = await getTwilioClientForOrg(clientOrgId)
            await client.calls(ref).update({ twiml: vr.toString() })
          } catch (err) {
            console.error("[twilio-voice-status] voicemail redirect failed", { ref, error: String(err) })
          }
        }
      }
      return new NextResponse(null, { status: 204 })
    }

    // initiated / ringing / queued — no-op.
    return new NextResponse(null, { status: 204 })
  }

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
    .select("id, org_id, answered_at, started_at")
    .eq("call_sid", matchSid)
    .maybeSingle()

  if (!existing) {
    console.warn("[twilio-voice-status] no matching calls row", { matchSid, callStatus })
    return new NextResponse(null, { status: 204 })
  }
  if (orgMismatch(existing.org_id)) return new NextResponse("Forbidden", { status: 403 })

  const now = new Date().toISOString()
  const updates: Record<string, any> = { status: callStatus }

  switch (callStatus) {
    case "in-progress":
      updates.answered_at = existing.answered_at ?? now
      break
    case "completed":
      // The call-log table + stats read duration_seconds (the column the UI uses);
      // keep duration too for backward consistency.
      updates.duration_seconds = Number(callDuration) || null
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

  // Defensive backfill: if a terminal update lands on a row whose started_at is
  // still NULL (e.g. an insert raced or failed), stamp it now so the call can't be
  // filtered out of the Calls page. Never overwrite a real value.
  const isTerminal = ["completed", "no-answer", "busy", "failed", "canceled"].includes(callStatus)
  if (isTerminal && !existing.started_at) {
    updates.started_at = now
  }

  const { error } = await supabaseAdmin.from("calls").update(updates).eq("id", existing.id)
  if (error) {
    console.error("[twilio-voice-status] update failed", { matchSid, error })
    return new NextResponse("Error", { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
