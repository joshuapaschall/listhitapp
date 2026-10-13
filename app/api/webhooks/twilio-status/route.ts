import { NextRequest, NextResponse } from "next/server"

import { processTwilioStatusEvent } from "@/lib/twilio-status-processor"
import { getTwilioClientForOrg } from "@/lib/twilio/org-client"
import { verifyTwilioWebhook } from "@/lib/twilio/verify-webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Public callback URL Twilio signs against. Must match the statusCallback the
// provider set on each message exactly, or signature verification fails.
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

  // Fail closed — never process an unvalidated status callback.
  const verified = await verifyTwilioWebhook({
    signature: request.headers.get("x-twilio-signature") || "",
    url: callbackUrl(),
    params,
  })
  if (!verified.ok) {
    console.warn("[twilio-status] rejected webhook", { reason: verified.reason })
    return new Response("Forbidden", { status: 403 })
  }

  const messageSid = params.MessageSid
  const messageStatus = params.MessageStatus
  const errorCode = params.ErrorCode || null

  // The message lives in the signing subaccount; only its own client can fetch
  // it for the cost/segment backfill.
  const loadClient = verified.orgId ? () => getTwilioClientForOrg(verified.orgId as string) : null

  return processTwilioStatusEvent({ messageSid, messageStatus, errorCode, loadClient })
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
