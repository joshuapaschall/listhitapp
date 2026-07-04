import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"

import { assertServer } from "@/utils/assert-server"
import { supabaseAdmin } from "@/lib/supabase"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { getOrgTwilio } from "@/lib/org-twilio/service"
import { resolveVoiceProviderName, parseTelnyxPinnedOrgIds } from "@/lib/providers/voice/routing"
import { parseVoiceIdentity } from "@/lib/providers/voice/identity"

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

  // Insert the call-log row keyed on the parent (browser) leg CallSid. Non-fatal:
  // the call must still connect even if logging fails.
  const { error: insertErr } = await supabaseAdmin.from("calls").insert({
    call_sid: params.CallSid,
    org_id: orgId,
    direction: "outbound",
    from_number: callerId,
    to_number: to,
    status: "initiated",
    provider: "twilio",
    webrtc: true,
  })
  if (insertErr) {
    console.error("[twilio-voice-twiml] call-log insert failed (non-fatal)", { orgId, error: insertErr })
  }

  const vr = new twilio.twiml.VoiceResponse()
  const dial = vr.dial({
    callerId,
    // Auto-record the bridged conversation (dual channel, only after answer),
    // matching the Telnyx auto-record model. Completion posts to the recording
    // webhook. Independent of the <Number> statusCallback below.
    record: "record-from-answer-dual",
    recordingStatusCallback: `${baseUrl()}/api/webhooks/twilio-recording`,
    recordingStatusCallbackMethod: "POST",
    recordingStatusCallbackEvent: ["completed"],
  })
  dial.number(
    {
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallback: `${baseUrl()}/api/webhooks/twilio-voice-status`,
      statusCallbackMethod: "POST",
    },
    to,
  )
  return xml(vr.toString())
}
