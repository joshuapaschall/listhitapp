import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"

import { processTwilioStatusEvent } from "@/lib/twilio-status-processor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Public callback URL Twilio signs against. Must match the statusCallback the
// provider set on each message exactly, or validateRequest fails.
function callbackUrl(): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  return `${base}/api/webhooks/twilio-status`
}

export async function POST(request: NextRequest) {
  const raw = await request.text()
  const params: Record<string, string> = {}
  for (const [key, value] of new URLSearchParams(raw)) {
    params[key] = value
  }

  const authToken = process.env.LISTHIT_TWILIO_AUTH_TOKEN
  if (!authToken) {
    // Fail closed — never process an unvalidated status callback.
    console.error("[twilio-status] LISTHIT_TWILIO_AUTH_TOKEN is not set; rejecting webhook")
    return new Response("Forbidden", { status: 403 })
  }

  const signature = request.headers.get("x-twilio-signature") || ""
  if (!twilio.validateRequest(authToken, signature, callbackUrl(), params)) {
    return new Response("Invalid signature", { status: 403 })
  }

  const messageSid = params.MessageSid
  const messageStatus = params.MessageStatus
  const errorCode = params.ErrorCode || null

  return processTwilioStatusEvent({ messageSid, messageStatus, errorCode })
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
