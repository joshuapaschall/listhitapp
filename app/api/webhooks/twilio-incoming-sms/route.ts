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

import { assertServer } from "@/utils/assert-server"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { resolveOrgIdByDid } from "@/lib/inbound-numbers"
import { handleInboundSms } from "@/lib/sms/inbound-handler"
import { verifyTwilioWebhook } from "@/lib/twilio/verify-webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

assertServer()

// Empty TwiML — a 2xx body Twilio parses as "no auto-reply".
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

// Public callback URL Twilio signs against — must match the Messaging Service's
// inboundRequestUrl exactly, or signature verification fails.
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

  // Fail closed — never process an unvalidated inbound webhook.
  const verified = await verifyTwilioWebhook({
    signature: request.headers.get("x-twilio-signature") || "",
    url: callbackUrl(),
    params,
  })
  if (!verified.ok) {
    console.warn("[twilio-incoming-sms] rejected webhook", { reason: verified.reason })
    return new NextResponse("Forbidden", { status: 403 })
  }

  // The subaccount that signed the webhook owns the org. A DID mapped to a
  // different org must never receive this message.
  if (verified.orgId) {
    const didOrgId = await resolveOrgIdByDid(params.To ? formatPhoneE164(params.To) : null)
    if (didOrgId && didOrgId !== verified.orgId) {
      console.warn("[twilio-webhook] org mismatch", { route: "twilio-incoming-sms", accountSid: verified.accountSid })
      return new NextResponse("Forbidden", { status: 403 })
    }
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
    verifiedOrgId: verified.orgId,
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
