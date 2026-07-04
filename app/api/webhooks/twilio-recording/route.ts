import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"

import { assertServer } from "@/utils/assert-server"
import { supabaseAdmin } from "@/lib/supabase"
import { recordingStoragePath } from "@/lib/voice/twilio-voicemail"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

assertServer()

const RECORDING_BUCKET = "call-recordings"

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
}

// Full public URL Twilio signed against — includes the ?ref=… query (conference
// recording), so signature validation must match it exactly.
function fullCallbackUrl(url: URL): string {
  return `${baseUrl()}${url.pathname}${url.search}`
}

// Twilio media URLs require Basic auth (accountSid:authToken). Retry — the media can
// lag the callback slightly.
async function downloadRecording(mp3Url: string): Promise<ArrayBuffer | null> {
  const accountSid = process.env.LISTHIT_TWILIO_ACCOUNT_SID
  const authToken = process.env.LISTHIT_TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) return null
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(mp3Url, { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" })
      if (res.ok) return await res.arrayBuffer()
      console.warn("[twilio-recording] download non-ok", { attempt, status: res.status })
    } catch (err) {
      console.warn("[twilio-recording] download error", { attempt, err })
    }
  }
  return null
}

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody).entries())

  const authToken = process.env.LISTHIT_TWILIO_AUTH_TOKEN
  if (!authToken) {
    console.error("[twilio-recording] LISTHIT_TWILIO_AUTH_TOKEN is not set; rejecting webhook")
    return new NextResponse("Forbidden", { status: 403 })
  }
  const url = new URL(request.url)
  const ref = url.searchParams.get("ref")
  const signature = request.headers.get("x-twilio-signature") || ""
  if (!twilio.validateRequest(authToken, signature, fullCallbackUrl(url), params)) {
    return new NextResponse("Invalid signature", { status: 403 })
  }

  const recordingSid = params.RecordingSid
  const recordingUrl = params.RecordingUrl
  const recordingDuration = Number(params.RecordingDuration)
  const recordingStatus = params.RecordingStatus
  const conferenceSid = params.ConferenceSid

  // Conference recording callbacks carry no CallSid — correlate via ?ref=<agentCallSid>.
  // Keep CallSid as a fallback for any legacy dial-recording callback.
  const matchSid = ref || params.CallSid
  if (!matchSid) {
    return new NextResponse("Missing ref/CallSid", { status: 400 })
  }

  // Never clobber a voicemail row — that flow (V3a) owns its own recording. If no
  // row exists, nothing to attach to.
  const { data: existing } = await supabaseAdmin
    .from("calls")
    .select("status")
    .eq("call_sid", matchSid)
    .maybeSingle()
  if (!existing) {
    console.warn("[twilio-recording] no matching calls row", { matchSid })
    return new NextResponse(null, { status: 204 })
  }
  if (existing.status === "voicemail") {
    console.log("[twilio-recording] skipping — row is a voicemail", { matchSid })
    return new NextResponse(null, { status: 204 })
  }

  // No usable recording (never answered / empty): mark state ready, leave status.
  if (recordingStatus !== "completed" || !Number.isFinite(recordingDuration) || recordingDuration <= 0) {
    await supabaseAdmin.from("calls").update({ recording_state: "ready" }).eq("call_sid", matchSid)
    return new NextResponse(null, { status: 204 })
  }

  // Download the mp3. Storage hiccups must NOT 5xx (Twilio would retry+redownload).
  const bytes = recordingUrl ? await downloadRecording(`${recordingUrl}.mp3`) : null
  if (!bytes) {
    await supabaseAdmin.from("calls").update({ recording_state: "failed" }).eq("call_sid", matchSid)
    return new NextResponse(null, { status: 204 })
  }

  const path = recordingStoragePath(recordingSid || matchSid)
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(RECORDING_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: "audio/mpeg", upsert: true })
  if (uploadErr) {
    console.error("[twilio-recording] upload failed", { matchSid, path, error: uploadErr })
    await supabaseAdmin.from("calls").update({ recording_state: "failed" }).eq("call_sid", matchSid)
    return new NextResponse(null, { status: 204 })
  }

  // Write the storage PATH into recording_url (the stream route signs call-recordings
  // for non-voicemail rows). Match the Telnyx columns; leave status untouched.
  const { error: updateErr } = await supabaseAdmin
    .from("calls")
    .update({
      recording_url: path,
      recording_state: "ready",
      recording_duration_seconds: Number.isFinite(recordingDuration) ? recordingDuration : null,
      ...(conferenceSid ? { conference_sid: conferenceSid } : {}),
    })
    .eq("call_sid", matchSid)
  if (updateErr) {
    console.error("[twilio-recording] calls update failed", { matchSid, error: updateErr })
    return new NextResponse("Error", { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
