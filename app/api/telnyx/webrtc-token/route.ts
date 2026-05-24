export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import {
  createWebRTCToken,
  ensureUserTelephonyCredential,
} from "@/lib/telnyx/credentials"

export async function POST() {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 },
      )
    }

    const credential = await ensureUserTelephonyCredential(user.id)
    const { token } = await createWebRTCToken(credential.id)

    return NextResponse.json(
      {
        ok: true,
        login_token: token,
        sip_username: credential.username,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to mint WebRTC token"
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 })
}
