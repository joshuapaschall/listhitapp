import { Buffer } from "node:buffer"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import { dialCall, hangupCall } from "@/lib/voice/call-control"
import { getWebRTCSipUri } from "@/lib/voice/webrtc-sip"
import { getCallControlAppId } from "@/lib/voice-env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as { to?: string; from?: string }
    const to = (body.to ?? "").trim()
    const from = (body.from ?? "").trim()
    if (!to || !from) {
      return NextResponse.json({ ok: false, error: "Missing 'to' or 'from'" }, { status: 400 })
    }

    const connectionId = getCallControlAppId()
    if (!connectionId) {
      return NextResponse.json({ ok: false, error: "Missing CALL_CONTROL_APP_ID" }, { status: 500 })
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
