import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-error"
import { requireOrgContext } from "@/lib/auth/org-context"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { ensureOrgSubaccount, ensureOrgVoiceCredentials } from "@/lib/twilio/subaccounts"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Platform-admin tool: create (or adopt) an org's Twilio subaccount and its voice
// API key + TwiML App. Idempotent. Never returns a token or secret.
export async function POST(request: Request) {
  const { user } = await requireOrgContext()
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  if (!isPlatformAdmin(user.id)) {
    return NextResponse.json({ ok: false, error: "Platform admin only" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const orgId = typeof body?.orgId === "string" ? body.orgId.trim() : ""
  if (!UUID_RE.test(orgId)) {
    return NextResponse.json({ ok: false, error: "orgId (uuid) is required" }, { status: 400 })
  }

  try {
    const { subaccountSid } = await ensureOrgSubaccount(orgId)
    const { apiKeySid, twimlAppSid } = await ensureOrgVoiceCredentials(orgId)
    return NextResponse.json({ ok: true, subaccountSid, apiKeySid, twimlAppSid })
  } catch (err) {
    return apiError(err, 500, "Could not set up the Twilio subaccount. Check the server logs.", { ok: false })
  }
}
