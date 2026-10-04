export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import { requirePermission } from "@/lib/permissions/server"
import { resolveOrgIdForUser } from "@/lib/auth/org-context"
import { requireTelnyxPinnedOrg } from "@/lib/auth/telnyx-guard"

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
    }

    const denied = await requirePermission(supabase, "calls.make_receive")
    if (denied) return denied

    const orgId = await resolveOrgIdForUser(user.id)
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "No organization" }, { status: 403 })
    }
    const notPinned = requireTelnyxPinnedOrg(orgId)
    if (notPinned) return notPinned

    const login = (process.env.TELNYX_WEBRTC_SIP_USERNAME ?? "").trim()
    const password = (process.env.TELNYX_WEBRTC_SIP_PASSWORD ?? "").trim()
    if (!login || !password) {
      return NextResponse.json(
        { ok: false, error: "WebRTC SIP credentials not configured" },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { ok: true, login, password },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get credentials"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
