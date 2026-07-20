import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"

import { assertServer } from "@/utils/assert-server"
import { supabaseAdmin } from "@/lib/supabase"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { getOrgTwilio } from "@/lib/org-twilio/service"
import { resolveVoiceProviderName, parseTelnyxPinnedOrgIds } from "@/lib/providers/voice/routing"
import { buildVoiceIdentity } from "@/lib/providers/voice/identity"
import { getRoutingConfig, getVoicemailGreetingUrl } from "@/lib/voice/routing"
import { appendVoicemailTwiml } from "@/lib/voice/twilio-voicemail"
import { getTwilioClient } from "@/lib/providers/twilio/client"
import { inboundConferenceRoomName, refCallbackUrl } from "@/lib/voice/twilio-conference"

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
  extra: Record<string, any> = {},
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
    // The Calls page filters/sorts by started_at (matches the Telnyx path). Both the
    // conference and the no-answer/voicemail paths insert through here, so stamping
    // it once keeps every inbound Twilio call (voicemails included) in the log.
    started_at: new Date().toISOString(),
    ...extra,
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

  // Per-DID routing mode (browser_only / forwarding_only / browser_first_then_forward).
  const routing = await getRoutingConfig(to)
  const needsForward =
    routing.routingMode === "forwarding_only" || routing.routingMode === "browser_first_then_forward"
  // Never dead-end on a misconfigured forward (mirror the Telnyx effective-mode guard):
  // a forward mode with no number downgrades to browser_only.
  const effectiveMode =
    needsForward && !routing.forwardingNumber ? "browser_only" : routing.routingMode
  const ringTimeout =
    routing.browserRingTimeoutSeconds > 0 ? routing.browserRingTimeoutSeconds : RING_TIMEOUT_SECONDS

  // Which legs the <Dial> rings (Twilio rings <Client> + <Number> in parallel;
  // first to answer wins). forwarding_only → number only; browser_only → clients
  // only; browser_first_then_forward → both.
  const ringClients = effectiveMode !== "forwarding_only"
  const ringForward =
    (effectiveMode === "forwarding_only" || effectiveMode === "browser_first_then_forward") &&
    Boolean(routing.forwardingNumber)

  console.log("[twilio-voice-incoming] routing", {
    orgId,
    did: to,
    requestedMode: routing.routingMode,
    effectiveMode,
    onlineCount: onlineUserIds.length,
    hasForward: Boolean(routing.forwardingNumber),
  })

  // No reachable leg → voicemail. Only browser modes with zero online AND no forward
  // in play get here; forwarding_only always has a forward (else it was downgraded),
  // and browser_first_then_forward with a forward still rings the number.
  const willRingAnyLeg = (ringClients && onlineUserIds.length > 0) || ringForward
  if (!willRingAnyLeg) {
    console.warn("[twilio-voice-incoming] no reachable legs — voicemail", { orgId, effectiveMode })
    await insertInboundRow(params, orgId, from, to)
    return voicemailResponse(to)
  }

  // Reachable-leg path → conference. The caller joins a room and WAITS; each agent
  // (browser client and/or forward number) is dialed INTO the same room. No-answer
  // is detected by an aggregated agent-leg counter in the status webhook (there is
  // no single DialCallStatus signal in the conference model).
  const callerCallSid = params.CallSid
  const room = inboundConferenceRoomName(callerCallSid)

  const agentTargets: string[] = []
  if (ringClients) {
    for (const uid of onlineUserIds) agentTargets.push(`client:${buildVoiceIdentity(orgId, uid)}`)
  }
  if (ringForward && routing.forwardingNumber) {
    agentTargets.push(routing.forwardingNumber)
  }

  await insertInboundRow(params, orgId, from, to, {
    conference_name: room,
    agent_legs_remaining: agentTargets.length,
    agent_answered: false,
  })

  // Dial each agent INTO the room (fire all; non-fatal per leg). Each agent-leg
  // status callback carries ?ref=<callerCallSid>&role=agent so the status webhook
  // runs the no-answer counter and redirects the waiting caller to voicemail when
  // the last agent leg ends unanswered.
  const agentStatusCallback =
    refCallbackUrl(baseUrl(), "/api/webhooks/twilio-voice-status", callerCallSid) + "&role=agent"
  const agentTwiml = `<Response><Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="false">${room}</Conference></Dial></Response>`
  for (const target of agentTargets) {
    try {
      await getTwilioClient().calls.create({
        to: target,
        from,
        timeout: ringTimeout,
        twiml: agentTwiml,
        statusCallback: agentStatusCallback,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        statusCallbackMethod: "POST",
      })
    } catch (err) {
      console.error("[twilio-voice-incoming] agent dial-in failed", { room, target, error: String(err) })
    }
  }

  // Return the caller into the room, waiting for an agent. record-from-start records
  // the whole conference; endConferenceOnExit=true ends the room if the caller hangs
  // up. All callbacks carry ?ref=<callerCallSid>.
  const vr = new twilio.twiml.VoiceResponse()
  const dial = vr.dial({})
  dial.conference(
    {
      startConferenceOnEnter: false,
      endConferenceOnExit: true,
      record: "record-from-start",
      recordingStatusCallback: refCallbackUrl(baseUrl(), "/api/webhooks/twilio-recording", callerCallSid),
      recordingStatusCallbackEvent: ["completed"],
      statusCallback: refCallbackUrl(baseUrl(), "/api/webhooks/twilio-conference-events", callerCallSid),
      statusCallbackEvent: ["start", "end", "join", "leave"],
    },
    room,
  )
  return xml(vr.toString())
}
