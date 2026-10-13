import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { supabaseAdmin } from "@/lib/supabase"
import { verifyTwilioWebhook } from "@/lib/twilio/verify-webhook"

// Twilio TrustHub CustomerProfile status callback. Sessionless — uses
// supabaseAdmin only. A signed callback (AccountSid + X-Twilio-Signature) is
// verified like every other Twilio webhook. Otherwise the only accepted proof is
// the dedicated LISTHIT_TWILIO_STATUS_CALLBACK_TOKEN query token — never a cron
// secret, which must not sit in a URL handed to Twilio.
export const runtime = "nodejs"

// Public URL Twilio signed: the registered callback, including its query string.
function callbackUrl(request: NextRequest): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
  return `${base}/api/webhooks/twilio-trusthub${request.nextUrl.search}`
}

function tokenMatches(request: NextRequest): boolean {
  const expected = process.env.LISTHIT_TWILIO_STATUS_CALLBACK_TOKEN || ""
  if (!expected) return false
  const provided = request.nextUrl.searchParams.get("token") || ""
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text()
    const params: Record<string, string> = {}
    for (const [key, value] of new URLSearchParams(raw)) params[key] = value

    const signature = request.headers.get("x-twilio-signature") || ""
    let verifiedOrgId: string | null = null
    if (params.AccountSid && signature) {
      const verified = await verifyTwilioWebhook({ signature, url: callbackUrl(request), params })
      if (!verified.ok) {
        console.warn("[twilio-trusthub] rejected webhook", { reason: verified.reason })
        return new NextResponse("Forbidden", { status: 403 })
      }
      verifiedOrgId = verified.orgId
    } else if (!tokenMatches(request)) {
      console.warn("[twilio-trusthub] rejected webhook", { reason: "missing_signature" })
      return new NextResponse("Forbidden", { status: 403 })
    }

    const sid = params.Sid || ""
    const status = params.Status || ""

    if (!sid) return new NextResponse(null, { status: 204 })

    const { data: row } = await supabaseAdmin
      .from("org_twilio")
      .select("id, org_id")
      .eq("secondary_profile_sid", sid)
      .maybeSingle()

    // Unknown SID → 204 (idempotent, don't leak whether the resource exists).
    if (!row) return new NextResponse(null, { status: 204 })
    if (verifiedOrgId && row.org_id !== verifiedOrgId) {
      console.warn("[twilio-webhook] org mismatch", { route: "twilio-trusthub" })
      return new NextResponse("Forbidden", { status: 403 })
    }

    const update: Record<string, unknown> = {
      customer_profile_status: status || null,
      updated_at: new Date().toISOString(),
    }
    // CP rejection fails the pipeline; approval alone does NOT advance a2p_status.
    if (status === "twilio-rejected") update.a2p_status = "failed"

    await supabaseAdmin.from("org_twilio").update(update).eq("id", row.id)

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("[twilio-trusthub webhook] failed", err)
    return new NextResponse(null, { status: 204 })
  }
}
