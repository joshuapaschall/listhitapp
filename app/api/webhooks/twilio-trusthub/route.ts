import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { advanceRegistration } from "@/lib/org-twilio/engine"
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

    // Trust Hub bundle SIDs are BU + 32 hex; anything else can't match (and is
    // never interpolated into the filter below).
    if (!/^BU[0-9a-f]{32}$/i.test(sid)) return new NextResponse(null, { status: 204 })

    // The bundle is either the customer profile or the TrustProduct (both are also
    // kept in provisioning_state).
    const { data: row } = await supabaseAdmin
      .from("org_twilio")
      .select("id, org_id, secondary_profile_sid, trust_product_sid")
      .or(`secondary_profile_sid.eq.${sid},trust_product_sid.eq.${sid}`)
      .maybeSingle()

    // Unknown SID → 204 (idempotent, don't leak whether the resource exists).
    if (!row) return new NextResponse(null, { status: 204 })
    if (verifiedOrgId && row.org_id !== verifiedOrgId) {
      console.warn("[twilio-webhook] org mismatch", { route: "twilio-trusthub" })
      return new NextResponse("Forbidden", { status: 403 })
    }

    // Record the status only; the registration engine owns every stage change.
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (row.trust_product_sid === sid) update.trust_product_status = status || null
    else update.customer_profile_status = status || null
    await supabaseAdmin.from("org_twilio").update(update).eq("id", row.id)

    try {
      await advanceRegistration(row.org_id, { reason: `trusthub:${status || "update"}` })
    } catch (err) {
      console.error("[twilio-trusthub webhook] advance failed", { orgId: row.org_id }, err)
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("[twilio-trusthub webhook] failed", err)
    return new NextResponse(null, { status: 204 })
  }
}
