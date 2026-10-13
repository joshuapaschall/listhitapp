import { NextRequest, NextResponse } from "next/server"

import { assertServer } from "@/utils/assert-server"
import { supabaseAdmin } from "@/lib/supabase"
import { getTwilioBasicAuthForAccount } from "@/lib/twilio/org-client"
import { verifyTwilioWebhook } from "@/lib/twilio/verify-webhook"
import { voicemailStoragePath } from "@/lib/voice/twilio-voicemail"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

assertServer()

const VOICEMAIL_BUCKET = "voicemails"

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
}

// Public URL Twilio signs against — must match the <Record recordingStatusCallback>.
function callbackUrl(): string {
  return `${baseUrl()}/api/webhooks/twilio-voicemail-recording`
}

// Twilio media URLs require Basic auth for the account that owns the recording
// (the tenant's subaccount). Retry a few times — the media can lag the callback.
async function downloadRecording(mp3Url: string, accountSid: string): Promise<ArrayBuffer | null> {
  const authorization = await getTwilioBasicAuthForAccount(accountSid)
  if (!authorization) {
    console.warn("[twilio-voicemail-recording] no credentials for recording account; skipping download")
    return null
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(mp3Url, { headers: { Authorization: authorization }, cache: "no-store" })
      if (res.ok) return await res.arrayBuffer()
      console.warn("[twilio-voicemail-recording] download non-ok", { attempt, status: res.status })
    } catch (err) {
      console.warn("[twilio-voicemail-recording] download error", { attempt, err })
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

  const verified = await verifyTwilioWebhook({
    signature: request.headers.get("x-twilio-signature") || "",
    url: callbackUrl(),
    params,
  })
  if (!verified.ok) {
    console.warn("[twilio-voicemail-recording] rejected webhook", { reason: verified.reason })
    return new NextResponse("Forbidden", { status: 403 })
  }

  const recordingSid = params.RecordingSid
  const recordingUrl = params.RecordingUrl
  const recordingDuration = Number(params.RecordingDuration)
  const recordingStatus = params.RecordingStatus
  const callSid = params.CallSid

  if (!callSid) {
    return new NextResponse("Missing CallSid", { status: 400 })
  }

  // The verified subaccount owns the org; never write onto another org's call.
  if (verified.orgId) {
    const { data: callRow } = await supabaseAdmin
      .from("calls")
      .select("org_id")
      .eq("call_sid", callSid)
      .maybeSingle()
    if (callRow?.org_id && callRow.org_id !== verified.orgId) {
      console.warn("[twilio-webhook] org mismatch", { route: "twilio-voicemail-recording", callSid })
      return new NextResponse("Forbidden", { status: 403 })
    }
  }

  // Discard empty/failed voicemails (mirror the Telnyx handler): mark missed.
  if (recordingStatus !== "completed" || !Number.isFinite(recordingDuration) || recordingDuration <= 0) {
    await supabaseAdmin
      .from("calls")
      .update({ status: "missed", recording_state: "ready" })
      .eq("call_sid", callSid)
    return new NextResponse(null, { status: 204 })
  }

  // Download the mp3. Storage hiccups must NOT 5xx (Twilio would retry+redownload) —
  // mark the state and 204.
  const bytes = recordingUrl ? await downloadRecording(`${recordingUrl}.mp3`, verified.accountSid) : null
  if (!bytes) {
    await supabaseAdmin.from("calls").update({ recording_state: "failed" }).eq("call_sid", callSid)
    return new NextResponse(null, { status: 204 })
  }

  const path = voicemailStoragePath(recordingSid || callSid)
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(VOICEMAIL_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: "audio/mpeg", upsert: true })
  if (uploadErr) {
    console.error("[twilio-voicemail-recording] upload failed", { callSid, path, error: uploadErr })
    await supabaseAdmin.from("calls").update({ recording_state: "failed" }).eq("call_sid", callSid)
    return new NextResponse(null, { status: 204 })
  }

  // Write the storage path into recording_url (the stream route reads THIS and picks
  // the voicemails bucket when status === "voicemail") + the parallel voicemail cols.
  const { error: updateErr } = await supabaseAdmin
    .from("calls")
    .update({
      voicemail: true,
      status: "voicemail",
      recording_url: path,
      voicemail_storage_path: path,
      voicemail_duration_seconds: Number.isFinite(recordingDuration) ? recordingDuration : null,
      recording_state: "ready",
    })
    .eq("call_sid", callSid)
  if (updateErr) {
    console.error("[twilio-voicemail-recording] calls update failed", { callSid, error: updateErr })
    return new NextResponse("Error", { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
