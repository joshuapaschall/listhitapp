import { Buffer } from "node:buffer"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import { dialCall, hangupCall } from "@/lib/voice/call-control"
import { getWebRTCSipUri } from "@/lib/voice/webrtc-sip"
import { getCallControlAppId } from "@/lib/voice-env"
import { listPurchasedNumbersForOrigin, type FromNumber } from "@/lib/telnyx/numbers"
import { resolveOutboundFrom } from "@/lib/sender/sticky-sender"
import { supabaseAdmin } from "@/lib/supabase"
import { formatPhoneE164 } from "@/lib/dedup-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Same default-pick logic as app/api/numbers/list.
function chooseDefault(items: FromNumber[]) {
  return (
    items.find((i) => i.assignedToApp)?.e164 ||
    items.find((i) => i.verified)?.e164 ||
    null
  )
}

export async function POST(req: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      to?: string
      from?: string
      buyerId?: string | null
    }
    const to = (body.to ?? "").trim()
    const explicitFrom = (body.from ?? "").trim()
    const buyerId = (typeof body.buyerId === "string" && body.buyerId) || null
    if (!to) {
      return NextResponse.json({ ok: false, error: "Missing 'to'" }, { status: 400 })
    }

    const connectionId = getCallControlAppId()
    if (!connectionId) {
      return NextResponse.json({ ok: false, error: "Missing CALL_CONTROL_APP_ID" }, { status: 500 })
    }

    // Voice-capable caller IDs = app-assigned numbers (same source as numbers/list).
    const allNumbers = await listPurchasedNumbersForOrigin()
    const appAssigned = allNumbers.filter((n) => n.assignedToApp)
    const appAssignedByNorm = new Map<string, string>()
    for (const n of appAssigned) {
      const norm = formatPhoneE164(n.e164) || n.e164
      if (norm) appAssignedByNorm.set(norm, n.e164)
    }
    const matchAppAssigned = (candidate: string | null | undefined): string | null => {
      if (!candidate) return null
      const norm = formatPhoneE164(candidate) || candidate
      return appAssignedByNorm.get(norm) ?? null
    }

    // Caller ID = explicit pick (if app-assigned) → sticky (if app-assigned) → default app-assigned.
    let from: string | null = null
    if (explicitFrom) {
      from = matchAppAssigned(explicitFrom)
    }
    if (!from) {
      // READ-ONLY: calls resolve the SMS sticky but never write it.
      const sticky = await resolveOutboundFrom({
        client: supabaseAdmin,
        buyerId,
        threadId: null,
        explicitFrom: null,
      })
      from = matchAppAssigned(sticky)
    }
    if (!from) {
      from = chooseDefault(appAssigned)
    }
    if (!from) {
      return NextResponse.json({ ok: false, error: "No caller ID available" }, { status: 400 })
    }

    // 1) Dial the prospect (A-leg) from the Voice API App.
    const prospect = await dialCall({
      to,
      from,
      connectionId,
      answeringMachineDetection: "disabled",
    })
    if (!prospect.ok || !prospect.callControlId) {
      return NextResponse.json({ ok: false, error: prospect.error ?? "Failed to dial prospect" }, { status: 500 })
    }

    // 2) Dial the browser (B-leg) via the same Voice App, carrying the A-leg id
    //    in client_state so the webhook can bridge B->A when the browser answers.
    const sipUri = await getWebRTCSipUri()
    if (!sipUri) {
      await hangupCall(prospect.callControlId)
      return NextResponse.json({ ok: false, error: "WebRTC SIP URI not configured" }, { status: 500 })
    }

    const clientState = Buffer.from(
      JSON.stringify({ action: "bridge_outbound", prospectCallControlId: prospect.callControlId }),
    ).toString("base64")

    const browser = await dialCall({
      to: sipUri,
      from,
      connectionId,
      answeringMachineDetection: "disabled",
      clientState,
    })
    if (!browser.ok) {
      await hangupCall(prospect.callControlId)
      return NextResponse.json({ ok: false, error: browser.error ?? "Failed to connect browser" }, { status: 500 })
    }

    return NextResponse.json(
      {
        ok: true,
        callControlId: prospect.callControlId,
        browserCallControlId: browser.callControlId ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to place call"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
