import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"

import { assertServer } from "@/utils/assert-server"
import { supabaseAdmin } from "@/lib/supabase"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { getOrgTwilio } from "@/lib/org-twilio/service"
import { resolveVoiceProviderName, parseTelnyxPinnedOrgIds } from "@/lib/providers/voice/routing"
import { parseVoiceIdentity } from "@/lib/providers/voice/identity"
import { getTwilioClient } from "@/lib/providers/twilio/client"
import { conferenceRoomName, refCallbackUrl } from "@/lib/voice/twilio-conference"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

assertServer()

// A 2xx TwiML that ends the call cleanly. Returned on every failure path (except a
// bad signature, which is a plain 403) so Twilio never retries a doomed dial.
const HANGUP_TWIML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Hangup/></Response>"

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
}

// Public URL Twilio signs against — must match the TwiML App's Voice Request URL.
function callbackUrl(): string {
  return `${baseUrl()}/api/webhooks/twilio-voice-twiml`
}

function xml(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { "Content-Type": "text/xml" } })
}

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody).entries())

  const authToken = process.env.LISTHIT_TWILIO_AUTH_TOKEN
  if (!authToken) {
    console.error("[twilio-voice-twiml] LISTHIT_TWILIO_AUTH_TOKEN is not set; rejecting webhook")
    return new NextResponse("Forbidden", { status: 403 })
  }
  const signature = request.headers.get("x-twilio-signature") || ""
  if (!twilio.validateRequest(authToken, signature, callbackUrl(), params)) {
    return new NextResponse("Invalid signature", { status: 403 })
  }

  // Identity is signed into the JWT by us and delivered by Twilio as
  // From="client:<identity>" — trustworthy. Never derive the org from a custom param.
  const identity = (params.From ?? "").replace(/^client:/, "")
  const parsed = parseVoiceIdentity(identity)
  if (!parsed) {
    console.warn("[twilio-voice-twiml] unparseable identity — refusing dial", { from: params.From })
    return xml(HANGUP_TWIML)
  }
  const { orgId } = parsed

  const row = await getOrgTwilio(orgId)

  // Guard-first: re-run the routing decision. A pinned org can NEVER be dialed
  // through Twilio, even if a token was minted before a pin change.
  const provider = resolveVoiceProviderName(
    orgId,
    row,
    parseTelnyxPinnedOrgIds(process.env.TELNYX_PINNED_ORG_IDS),
  )
  if (provider !== "twilio") {
    console.warn("[twilio-voice-twiml] org not routed to twilio — refusing dial", { orgId })
    return xml(HANGUP_TWIML)
  }

  const callerId = row?.phone_number
  if (!callerId) {
    console.warn("[twilio-voice-twiml] org has no Twilio caller ID — refusing dial", { orgId })
    return xml(HANGUP_TWIML)
  }

  const to = formatPhoneE164(params.To ?? "")
  if (!to) {
    console.warn("[twilio-voice-twiml] invalid destination — refusing dial", { to: params.To })
    return xml(HANGUP_TWIML)
  }

  // Conference model: the agent joins a named room; the prospect is dialed into the
  // SAME room. Room name + ref both derive from the agent (browser) leg CallSid.
  const agentCallSid = params.CallSid
  const room = conferenceRoomName(agentCallSid)

  // Insert the call-log row keyed on the agent (browser) leg CallSid. Non-fatal:
  // the call must still connect even if logging fails.
  const { error: insertErr } = await supabaseAdmin.from("calls").insert({
    call_sid: agentCallSid,
    org_id: orgId,
    direction: "outbound",
    from_number: callerId,
    to_number: to,
    status: "initiated",
    provider: "twilio",
    webrtc: true,
    conference_name: room,
  })
  if (insertErr) {
    console.error("[twilio-voice-twiml] call-log insert failed (non-fatal)", { orgId, error: insertErr })
  }

  // Dial the prospect INTO the room. The created leg IS the far party (prospect) —
  // capture its SID immediately so V3d cold transfer keeps working. Its status
  // callback is correlated back to the row via ?ref=<agentCallSid>. The prospect's
  // endConferenceOnExit=false keeps the room alive if they drop before the agent.
  try {
    const leg = await getTwilioClient().calls.create({
      to,
      from: callerId,
      twiml: `<Response><Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="false">${room}</Conference></Dial></Response>`,
      statusCallback: refCallbackUrl(baseUrl(), "/api/webhooks/twilio-voice-status", agentCallSid),
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    })
    await supabaseAdmin.from("calls").update({ far_leg_sid: leg.sid }).eq("call_sid", agentCallSid)
  } catch (err) {
    console.error("[twilio-voice-twiml] prospect dial-in failed", { room, error: String(err) })
    return xml(HANGUP_TWIML)
  }

  // Return the agent into the room. record-from-start records the whole conference;
  // endConferenceOnExit on the AGENT preserves today's "agent hangs up → call ends".
  // All callbacks carry ?ref=<agentCallSid> for correlation.
  const vr = new twilio.twiml.VoiceResponse()
  const dial = vr.dial({})
  dial.conference(
    {
      startConferenceOnEnter: true,
      endConferenceOnExit: true,
      record: "record-from-start",
      recordingStatusCallback: refCallbackUrl(baseUrl(), "/api/webhooks/twilio-recording", agentCallSid),
      recordingStatusCallbackEvent: ["completed"],
      statusCallback: refCallbackUrl(baseUrl(), "/api/webhooks/twilio-conference-events", agentCallSid),
      statusCallbackEvent: ["start", "end", "join", "leave"],
    },
    room,
  )
  return xml(vr.toString())
}
