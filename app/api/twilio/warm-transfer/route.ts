import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { supabaseAdmin } from "@/lib/supabase"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { getTwilioClient } from "@/lib/providers/twilio/client"
import { getOrgTwilio } from "@/lib/org-twilio/service"

export const dynamic = "force-dynamic"

// Statuses that mean a call is still live and warm-transferable.
const LIVE_STATUSES = ["initiated", "ringing", "in-progress", "answered"]

function errorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string | number }
    const code = e.code != null ? ` (code ${e.code})` : ""
    if (e.message) return `${e.message}${code}`
  }
  return "Unknown Twilio error"
}

// Warm transfer (Twilio conference model). Three actions on one live call:
//   start    → hold the caller, dial an arbitrary colleague INTO the conference so
//              the agent can announce privately (the held caller can't hear).
//   complete → remove the AGENT leg; un-hold the caller. Caller ↔ colleague stay
//              connected (true warm handoff — the agent drops off).
//   cancel   → remove the COLLEAGUE leg; un-hold the caller. The agent is back
//              with the caller.
//
// The colleague's Call SID lives in CLIENT state (returned by `start`) and is
// re-validated server-side against the live conference's participant list before
// any removal — there is no calls-table column for a transfer-in-progress leg.
export async function POST(request: Request) {
  // Membership-only auth, matching the other Twilio voice routes. The live-call
  // lookup is org-scoped, so a member can only act on their own org's call.
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  try {
    const body = await request.json().catch(() => ({}))
    const action = body?.action as "start" | "complete" | "cancel" | undefined
    if (action !== "start" && action !== "complete" && action !== "cancel") {
      return apiError("Unknown action", 400)
    }

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

    if (!call) return apiError("No live call", 404)
    if (!call.conference_sid) return apiError("Call is not connected yet", 409)

    // The FAR party (the caller we hold): outbound → the prospect leg (far_leg_sid);
    // inbound → the caller = the row's own call_sid.
    const farParty = call.direction === "outbound" ? call.far_leg_sid : call.call_sid
    if (!farParty) return apiError("Call party unavailable", 409)

    const conf = getTwilioClient().conferences(call.conference_sid)

    if (action === "start") {
      const target = formatPhoneE164(body?.to)
      if (!target || !/^\+[0-9]+$/.test(target)) {
        return apiError("Valid number required", 400)
      }

      // Caller ID for the colleague dial must be a Twilio-owned number on the account.
      const orgTwilio = await getOrgTwilio(orgId)
      const fromNumber = orgTwilio?.phone_number
      if (!fromNumber) return apiError("Org has no Twilio number", 409)

      // Hold the caller so the colleague dial + announcement stay private.
      try {
        await conf.participants(farParty).update({ hold: true })
      } catch (err) {
        return apiError("Warm transfer failed (call may have ended)", 502, errorMessage(err))
      }

      // Dial the colleague INTO the same conference. endConferenceOnExit:false keeps
      // the room alive when the agent later drops on complete.
      try {
        const participant = await conf.participants.create({
          from: fromNumber,
          to: target,
          timeout: 25,
          label: "warm-transfer",
          endConferenceOnExit: false,
        })
        return NextResponse.json({ ok: true, colleagueSid: participant.callSid })
      } catch (err) {
        // Best-effort un-hold so a failed dial doesn't strand the caller on hold.
        try {
          await conf.participants(farParty).update({ hold: false })
        } catch {}
        return apiError("Could not reach that number", 502, errorMessage(err))
      }
    }

    // Both complete + cancel need a validated colleague leg.
    const colleagueSid = typeof body?.colleagueSid === "string" ? body.colleagueSid : ""
    if (!colleagueSid) return apiError("colleagueSid required", 400)

    let participants: Array<{ callSid?: string | null }>
    try {
      participants = await conf.participants.list({ limit: 20 })
    } catch (err) {
      return apiError("Warm transfer failed (call may have ended)", 502, errorMessage(err))
    }
    const colleaguePresent = participants.some((p) => p.callSid === colleagueSid)

    if (action === "complete") {
      // Colleague must still be in the room to hand the caller off to them.
      if (!colleaguePresent) return apiError("Colleague is no longer on the call", 409)

      // The AGENT leg is the participant that is neither the caller (farParty) nor
      // the colleague. Works for inbound (agent leg not stored on the row) and
      // outbound (resolves to the row's call_sid).
      const agentSid = participants
        .map((p) => p.callSid)
        .find((sid): sid is string => Boolean(sid) && sid !== farParty && sid !== colleagueSid)
      if (!agentSid) return apiError("Could not identify agent leg", 409)

      try {
        // Un-hold the caller BEFORE dropping the agent so caller ↔ colleague audio
        // is live the instant the agent leaves.
        await conf.participants(farParty).update({ hold: false })
        await conf.participants(agentSid).remove()
      } catch (err) {
        return apiError("Warm transfer failed (call may have ended)", 502, errorMessage(err))
      }
      return NextResponse.json({ ok: true })
    }

    // action === "cancel": drop the colleague, return the agent to the caller. If the
    // colleague already dropped, that's fine — still un-hold and report success.
    try {
      if (colleaguePresent) {
        try {
          await conf.participants(colleagueSid).remove()
        } catch {
          // Ignore "not found" — the colleague may have hung up between list + remove.
        }
      }
      await conf.participants(farParty).update({ hold: false })
    } catch (err) {
      return apiError("Warm transfer failed (call may have ended)", 502, errorMessage(err))
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err, 500)
  }
}
