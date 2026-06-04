import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import { requirePermission } from "@/lib/permissions/server"
import { supabaseAdmin } from "@/lib/supabase"
import { resolveOrgIdForUser } from "@/lib/auth/org-context"

export const runtime = "nodejs"

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const denied = await requirePermission(supabase, "calls.recordings")
    if (denied) return denied

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const orgId = await resolveOrgIdForUser(user.id)
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: "Recording id required" }, { status: 400 })
    }

    const { data: call, error } = await supabaseAdmin
      .from("calls")
      .select("recording_url, status, from_number, to_number, started_at")
      .eq("call_sid", id)
      .eq("org_id", orgId)
      .single()

    if (error || !call?.recording_url) {
      return NextResponse.json({ error: "No stored recording for this call" }, { status: 404 })
    }

    const bucket = call.status === "voicemail" ? "voicemails" : "call-recordings"

    const stamp = call.started_at ? new Date(call.started_at).toISOString().slice(0, 10) : "recording"
    const who = (call.from_number || call.to_number || "call").replace(/[^0-9+]/g, "")
    const downloadName = `${call.status === "voicemail" ? "voicemail" : "call"}-${who}-${stamp}.mp3`

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(call.recording_url, 300, { download: downloadName })

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ error: "Could not sign recording url" }, { status: 500 })
    }

    return NextResponse.redirect(signed.signedUrl)
  } catch (e) {
    console.error("[recordings/download] error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
