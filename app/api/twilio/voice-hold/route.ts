import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { supabaseAdmin } from "@/lib/supabase"
import { getTwilioClient } from "@/lib/providers/twilio/client"

export const dynamic = "force-dynamic"

// Statuses that mean a call is still live and holdable.
const LIVE_STATUSES = ["initiated", "ringing", "in-progress", "answered"]

function errorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string | number }
    const code = e.code != null ? ` (code ${e.code})` : ""
    if (e.message) return `${e.message}${code}`
  }
  return "Unknown Twilio error"
}

// Real hold: place the FAR party (outbound: the prospect leg far_leg_sid; inbound:
// the caller = the row's own call_sid) on hold in the conference so they hear hold
// music. Omitting holdUrl → Twilio's default hold music.
export async function POST(request: Request) {
  // Membership-only auth, matching the other Twilio voice routes. The live-call
  // lookup is org-scoped, so a member can only hold their own org's call.
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body?.hold !== "boolean") {
      return apiError("hold (boolean) required", 400)
    }
    const hold = body.hold as boolean

    // Resolve the org's live Twilio call server-side (don't trust a client SID).
    const { data: call } = await supabaseAdmin
      .from("calls")
      .select("call_sid, far_leg_sid, direction, status, conference_sid")
      .eq("org_id", orgId)
      .eq("provider", "twilio")
      .in("status", LIVE_STATUSES)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!call) return apiError("No live call to hold", 404)
    if (!call.conference_sid) return apiError("Call is not connected yet", 409)

    const participantSid = call.direction === "outbound" ? call.far_leg_sid : call.call_sid
    if (!participantSid) return apiError("Call party not available to hold", 409)

    try {
      await getTwilioClient()
        .conferences(call.conference_sid)
        .participants(participantSid)
        .update({ hold })
    } catch (err) {
      return apiError("Hold failed (call may have ended)", 502, errorMessage(err))
    }

    return NextResponse.json({ ok: true, hold })
  } catch (err) {
    return apiError(err, 500)
  }
}
