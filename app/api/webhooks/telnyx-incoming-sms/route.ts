// app/api/webhooks/telnyx-incoming-sms/route.ts
/**
 * Handles inbound Telnyx SMS/MMS webhooks and stores them in Supabase.
 * – GET  ➜ 200 OK        (health-check / Telnyx warm-up)
 * – POST ➜ 204 No Content (normal) or 4xx/5xx on errors
 *
 * This route is now only the Telnyx-specific edge: signature verification,
 * event discrimination (outbound-lifecycle events → status processor), and
 * payload parsing. The provider-agnostic downstream (buyer matching, threads,
 * message insert, STOP/HELP, DNC, media mirroring) lives in
 * `@/lib/sms/inbound-handler` and is shared with the Twilio inbound route.
 */

import { NextRequest, NextResponse } from "next/server"
import { assertServer } from "@/utils/assert-server"
import { verifyTelnyxRequest } from "@/lib/telnyx"
import { processTelnyxStatusEvent } from "@/lib/telnyx-status-processor"
import { handleInboundSms } from "@/lib/sms/inbound-handler"

export const runtime = "nodejs"

assertServer()

export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  console.log("📨 Telnyx webhook hit", {
    path: request.nextUrl.pathname,
    length: rawBody.length,
    headers: Object.fromEntries(request.headers),
  })

  if (!verifyTelnyxRequest(request, rawBody)) {
    return new NextResponse("Invalid signature", { status: 403 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch (err) {
    console.error("❌ JSON parse error:", err)
    return new NextResponse("Bad JSON", { status: 400 })
  }

  const event = body?.data?.event_type as string | undefined
  if (event !== "message.received") {
    // Outbound message lifecycle event (message.sent, message.delivered,
    // message.delivery_failed, message.finalized, etc.) — Telnyx delivers
    // these to the same inbound URL since there's no separate outbound URL
    // field on the messaging profile. Route to the status processor.
    console.log("[telnyx-incoming-sms] forwarding outbound event to status processor", { event })
    return processTelnyxStatusEvent(body)
  }

  const payload = body.data.payload
  if (!payload) {
    console.warn("⚠️ Payload missing:", body)
    return new NextResponse("No payload", { status: 400 })
  }

  const from =
    typeof payload.from === "string"
      ? payload.from
      : payload.from?.phone_number
  const to = Array.isArray(payload.to)
    ? payload.to[0]?.phone_number
    : typeof payload.to === "string"
    ? payload.to
    : payload.to?.phone_number
  const text = (payload.text as string | undefined)?.trim() ?? ""
  const rawMediaUrls = [
    ...(Array.isArray(payload.media)
      ? payload.media.map((m: any) => m.url)
      : []),
    ...(Array.isArray(payload.media_urls) ? payload.media_urls : []),
  ]
  const sid = payload.id as string | undefined

  return handleInboundSms({
    provider: "telnyx",
    from,
    to,
    text,
    rawMediaUrls,
    providerId: sid,
  })
}
