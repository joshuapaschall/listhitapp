// app/api/webhooks/twilio-incoming-sms/route.ts
/**
 * Handles inbound Twilio SMS/MMS webhooks (the Messaging Service inboundRequestUrl
 * set by T4) and feeds them into the SAME shared downstream the Telnyx route uses.
 * This route is only the Twilio-specific edge: form parsing + signature validation
 * + empty-TwiML response. All buyer matching / threads / STOP-HELP / DNC / media
 * lives in `@/lib/sms/inbound-handler`.
 *
 * – GET  ➜ 200 { ok: true }   (health-check)
 * – POST ➜ 200 empty TwiML on success; 4xx/5xx passed through so Twilio retries.
 */

import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"

import { assertServer } from "@/utils/assert-server"
import { handleInboundSms } from "@/lib/sms/inbound-handler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

assertServer()

// Empty TwiML — a 2xx body Twilio parses as "no auto-reply".
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

// Public callback URL Twilio signs against — must match the Messaging Service's
// inboundRequestUrl exactly, or validateRequest fails.
function callbackUrl(): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  return `${base}/api/webhooks/twilio-incoming-sms`
}

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const sp = new URLSearchParams(rawBody)
  const params = Object.fromEntries(sp.entries())

  const authToken = process.env.LISTHIT_TWILIO_AUTH_TOKEN
  if (!authToken) {
    // Fail closed — never process an unvalidated inbound webhook.
    console.error("[twilio-incoming-sms] LISTHIT_TWILIO_AUTH_TOKEN is not set; rejecting webhook")
    return new NextResponse("Forbidden", { status: 403 })
  }

  const signature = request.headers.get("x-twilio-signature") || ""
  if (!twilio.validateRequest(authToken, signature, callbackUrl(), params)) {
    return new NextResponse("Invalid signature", { status: 403 })
  }

  const text = (params.Body ?? "").trim()
  const numMedia = Math.min(Number(params.NumMedia) || 0, 10)
  const rawMediaUrls: string[] = []
  for (let i = 0; i < numMedia; i++) {
    const url = params[`MediaUrl${i}`]
    if (url) rawMediaUrls.push(url)
  }

  const res = await handleInboundSms({
    provider: "twilio",
    from: params.From,
    to: params.To,
    text,
    rawMediaUrls,
    providerId: params.MessageSid,
  })

  // Twilio treats any non-2xx as failure-and-retry, and a 2xx body as TwiML.
  // Success → empty TwiML (no auto-reply). Errors pass through so Twilio retries
  // on our 5xx and surfaces our 4xx.
  if (res.status >= 200 && res.status < 300) {
    return new NextResponse(EMPTY_TWIML, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    })
  }
  return res
}
