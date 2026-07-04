import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"

import { assertServer } from "@/utils/assert-server"
import { supabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

assertServer()

// Full public URL Twilio signed against — includes the ?ref=… query.
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
    console.error("[twilio-conference-events] LISTHIT_TWILIO_AUTH_TOKEN is not set; rejecting webhook")
    return new NextResponse("Forbidden", { status: 403 })
  }
  const url = new URL(request.url)
  const ref = url.searchParams.get("ref")
  const signature = request.headers.get("x-twilio-signature") || ""
  if (!twilio.validateRequest(authToken, signature, fullCallbackUrl(url), params)) {
    return new NextResponse("Invalid signature", { status: 403 })
  }

  const event = params.StatusCallbackEvent
  const conferenceSid = params.ConferenceSid

  // Correlate to the call-log row via ?ref=<agentCallSid>.
  if (!ref) {
    return new NextResponse(null, { status: 204 })
  }

  const { data: existing } = await supabaseAdmin
    .from("calls")
    .select("id, ended_at, status, direction, answered_at, duration_seconds")
    .eq("call_sid", ref)
    .maybeSingle()
  if (!existing) {
    console.warn("[twilio-conference-events] no matching calls row", { ref, event })
    return new NextResponse(null, { status: 204 })
  }

  if (event === "conference-start" || event === "start") {
    // Record the conference SID once the room is created.
    if (conferenceSid) {
      await supabaseAdmin.from("calls").update({ conference_sid: conferenceSid }).eq("id", existing.id)
    }
  } else if (event === "conference-end" || event === "end") {
    const TERMINAL = new Set(["completed", "voicemail", "missed", "failed", "canceled", "busy", "no-answer"])
    const currentStatus = (existing.status ?? "").toLowerCase()
    const updates: Record<string, any> = {}

    // Only fill ended_at when the status webhook hasn't already set a terminal
    // timestamp (never overwrite disposition/duration it already wrote).
    if (!existing.ended_at) updates.ended_at = new Date().toISOString()

    // Inbound answered calls get their terminal disposition + duration from the
    // conference lifecycle (the agent legs are not the call itself). Never clobber a
    // status the status/voicemail webhooks already made terminal (e.g. voicemail/missed).
    const answered = Boolean(existing.answered_at) || currentStatus === "in-progress"
    if (existing.direction === "inbound" && answered && !TERMINAL.has(currentStatus)) {
      const confDuration = Number(params.Duration)
      const computed = existing.answered_at
        ? Math.max(0, Math.round((Date.now() - Date.parse(existing.answered_at)) / 1000))
        : 0
      updates.status = "completed"
      if (existing.duration_seconds == null) {
        updates.duration_seconds =
          Number.isFinite(confDuration) && confDuration > 0 ? confDuration : computed
      }
    }

    if (Object.keys(updates).length) {
      await supabaseAdmin.from("calls").update(updates).eq("id", existing.id)
    }
  }
  // join / leave — participant choreography is later; log only.

  return new NextResponse(null, { status: 204 })
}
