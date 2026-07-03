import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"

import { assertServer } from "@/utils/assert-server"
import { supabaseAdmin } from "@/lib/supabase"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { getOrgTwilio } from "@/lib/org-twilio/service"
import { resolveVoiceProviderName, parseTelnyxPinnedOrgIds } from "@/lib/providers/voice/routing"
import { buildVoiceIdentity } from "@/lib/providers/voice/identity"
import { getVoicemailGreetingUrl } from "@/lib/voice/routing"
import { appendVoicemailTwiml } from "@/lib/voice/twilio-voicemail"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

assertServer()

const RING_TIMEOUT_SECONDS = 20

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
}

// Public URL Twilio signs against — must match the number's Voice Request URL.
function callbackUrl(): string {
  return `${baseUrl()}/api/webhooks/twilio-voice-incoming`
}

function xml(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { "Content-Type": "text/xml" } })
}

// A spoken message + hangup for every unroutable path (bad DID / not on twilio).
function sayHangup(message: string): NextResponse {
  const vr = new twilio.twiml.VoiceResponse()
  vr.say(message)
  vr.hangup()
  return xml(vr.toString())
}

// Voicemail TwiML: per-DID greeting (<Play>) or a <Say> fallback, then <Record>
// whose completion POSTs to the recording webhook.
async function voicemailResponse(to: string): Promise<NextResponse> {
  const greetingUrl = await getVoicemailGreetingUrl(to)
  const vr = new twilio.twiml.VoiceResponse()
  appendVoicemailTwiml(vr, {
    greetingUrl,
    recordingStatusCallback: `${baseUrl()}/api/webhooks/twilio-voicemail-recording`,
  })
  return xml(vr.toString())
}

// Insert the inbound call-log row keyed on the inbound CallSid so the recording
// webhook (and status updates) can find it. Non-fatal.
async function insertInboundRow(
  params: Record<string, string>,
  orgId: string,
  from: string,
  to: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from("calls").insert({
    call_sid: params.CallSid,
    org_id: orgId,
    direction: "inbound",
    from_number: from,
    to_number: to,
    status: "ringing",
    provider: "twilio",
    webrtc: true,
  })
  if (error) console.error("[twilio-voice-incoming] call-log insert failed (non-fatal)", { orgId, error })
}

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody).entries())

  const authToken = process.env.LISTHIT_TWILIO_AUTH_TOKEN
  if (!authToken) {
    console.error("[twilio-voice-incoming] LISTHIT_TWILIO_AUTH_TOKEN is not set; rejecting webhook")
    return new NextResponse("Forbidden", { status: 403 })
  }
  const signature = request.headers.get("x-twilio-signature") || ""
  if (!twilio.validateRequest(authToken, signature, callbackUrl(), params)) {
    return new NextResponse("Invalid signature", { status: 403 })
  }

  const from = params.From ?? ""
  const to = formatPhoneE164(params.To ?? "")
  if (!to) {
    console.warn("[twilio-voice-incoming] invalid To — refusing", { to: params.To })
    return sayHangup("This number is not available. Goodbye.")
  }

  // Post-<Dial> action callback: Twilio re-hits THIS same URL after the ring, with
  // DialCallStatus telling us whether a browser answered. Answered → hang up the
  // (already-ended) call; no-answer → voicemail on the surviving caller leg. This
  // keeps answered calls from ever reaching the record verb.
  if (params.DialCallStatus) {
    if (params.DialCallStatus === "completed" || params.DialCallStatus === "answered") {
      const vr = new twilio.twiml.VoiceResponse()
      vr.hangup()
      return xml(vr.toString())
    }
    console.log("[twilio-voice-incoming] no browser answered — voicemail", { dialStatus: params.DialCallStatus })
    return voicemailResponse(to)
  }

  // Resolve the org from the inbound DID.
  const { data: didRow } = await supabaseAdmin
    .from("inbound_numbers")
    .select("org_id")
    .eq("e164", to)
    .eq("enabled", true)
    .maybeSingle()
  const orgId = didRow?.org_id ?? null
  if (!orgId) {
    console.warn("[twilio-voice-incoming] no org for inbound DID — refusing", { to })
    return sayHangup("This number is not available. Goodbye.")
  }

  // Routing guard: only ring browsers for orgs actually routed to Twilio voice.
  const row = await getOrgTwilio(orgId)
  const provider = resolveVoiceProviderName(
    orgId,
    row,
    parseTelnyxPinnedOrgIds(process.env.TELNYX_PINNED_ORG_IDS),
  )
  if (provider !== "twilio") {
    console.warn("[twilio-voice-incoming] org not on twilio voice — refusing", { orgId })
    return sayHangup("This number is not available. Goodbye.")
  }

  // Find the org's online browsers (user_presence has no org_id — map via profiles).
  const { data: members } = await supabaseAdmin.from("profiles").select("id").eq("org_id", orgId)
  const userIds = (members ?? []).map((m) => m.id)
  const { data: online } = userIds.length
    ? await supabaseAdmin
        .from("user_presence")
        .select("user_id")
        .in("user_id", userIds)
        .eq("status", "online")
    : { data: [] as { user_id: string }[] }
  const onlineUserIds = Array.from(new Set((online ?? []).map((p) => p.user_id)))

  if (!onlineUserIds.length) {
    // Nobody online → straight to voicemail. Insert the row first so the recording
    // webhook can find it by call_sid and surface it in the call log.
    console.warn("[twilio-voice-incoming] no online browsers — voicemail", { orgId })
    await insertInboundRow(params, orgId, from, to)
    return voicemailResponse(to)
  }

  await insertInboundRow(params, orgId, from, to)

  // Ring every online browser as a named client; first to answer wins. Caller ID
  // is the real caller so the browser shows who's calling. `action` points back at
  // THIS route: after the ring we branch on DialCallStatus (answered → hangup;
  // no-answer → voicemail).
  const vr = new twilio.twiml.VoiceResponse()
  const dial = vr.dial({
    callerId: from,
    timeout: RING_TIMEOUT_SECONDS,
    answerOnBridge: true,
    action: callbackUrl(),
    method: "POST",
    // Auto-record the bridged conversation once a browser answers (dual channel).
    // record-from-answer-dual never fires on no-answer, so it never collides with
    // the voicemail <Record>. Recording completion is a separate callback from the
    // `action` (DialCallStatus) branch above.
    record: "record-from-answer-dual",
    recordingStatusCallback: `${baseUrl()}/api/webhooks/twilio-recording`,
    recordingStatusCallbackMethod: "POST",
    recordingStatusCallbackEvent: ["completed"],
  })
  for (const uid of onlineUserIds) {
    dial.client({}, buildVoiceIdentity(orgId, uid))
  }
  return xml(vr.toString())
}
