import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { supabaseAdmin } from "@/lib/supabase"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { getTwilioClient } from "@/lib/providers/twilio/client"

export const dynamic = "force-dynamic"

// Statuses that mean a call is still live and redirectable.
const LIVE_STATUSES = ["initiated", "ringing", "in-progress", "answered"]

function errorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string | number }
    const code = e.code != null ? ` (code ${e.code})` : ""
    if (e.message) return `${e.message}${code}`
  }
  return "Unknown Twilio error"
}

// Cold transfer: redirect the FAR party (outbound: the captured <Number> child leg;
// inbound: the caller = the row's own call_sid) to a new number. The agent's browser
// leg drops as the bridge ends.
export async function POST(request: Request) {
  // Membership-only auth, matching the other Twilio voice routes (voice-token). The
  // live-call lookup is org-scoped, so a member can only transfer their own org's call.
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  try {
    const { to } = await request.json()
    const target = formatPhoneE164(to)
    if (!target || !/^\+[0-9]+$/.test(target)) {
      return apiError("Valid transfer destination required", 400)
    }

    // Resolve the org's live Twilio call server-side (don't trust a client SID).
    const { data: call } = await supabaseAdmin
      .from("calls")
      .select("call_sid, far_leg_sid, direction, status")
      .eq("org_id", orgId)
      .eq("provider", "twilio")
      .in("status", LIVE_STATUSES)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!call) return apiError("No live call to transfer", 404)

    const targetSid = call.direction === "outbound" ? call.far_leg_sid : call.call_sid
    if (!targetSid) return apiError("Call not ready to transfer", 409)

    try {
      await getTwilioClient()
        .calls(targetSid)
        .update({ twiml: `<Response><Dial>${target}</Dial></Response>` })
    } catch (err) {
      return apiError("Transfer failed (call may have ended)", 502, errorMessage(err))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err, 500)
  }
}
