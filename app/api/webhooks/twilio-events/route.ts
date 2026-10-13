import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { advanceRegistration, eventsSignature } from "@/lib/org-twilio/engine"
import { getOrgCredentials } from "@/lib/twilio/credentials"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

// Twilio Event Streams sink for registration events (brand / campaign / number).
// The sink URL carries ?org=<orgId>&sig=<HMAC(orgId)>, minted by the engine.
// Events are wake-up signals only: their status values are never trusted — the
// engine re-fetches the real state from Twilio.

function signatureMatches(orgId: string, sig: string): boolean {
  if (!process.env.LISTHIT_SECRETS_KEY) return false
  const expected = Buffer.from(eventsSignature(orgId))
  const provided = Buffer.from(sig)
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided)
}

export async function POST(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org") || ""
  const sig = request.nextUrl.searchParams.get("sig") || ""
  if (!orgId || !sig || !signatureMatches(orgId, sig)) {
    console.warn("[twilio-events] rejected webhook", { reason: "bad_signature" })
    return new NextResponse("Forbidden", { status: 403 })
  }

  try {
    const payload = await request.json().catch(() => null)
    const events: any[] = Array.isArray(payload) ? payload : payload ? [payload] : []
    const creds = await getOrgCredentials(orgId)
    if (!creds) return NextResponse.json({ ok: true, ignored: events.length })

    // Only events from this org's own subaccount count.
    const relevant = events.filter((e) => {
      const accountSid = e?.data?.accountsid ?? e?.data?.account_sid ?? e?.data?.accountSid
      return accountSid === creds.subaccountSid
    })
    if (relevant.length) {
      await advanceRegistration(orgId, { reason: String(relevant[0]?.type || "event") })
    }
    return NextResponse.json({ ok: true, processed: relevant.length })
  } catch (err) {
    console.error("[twilio-events] failed", { orgId }, err)
    return NextResponse.json({ ok: true })
  }
}
