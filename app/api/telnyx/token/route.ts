export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import { supabaseAdmin } from "@/lib/supabase/admin"
import { createWebRTCToken } from "@/lib/telnyx/credentials"

export async function POST(req: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    let {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      const authHeader = req.headers.get("authorization") || ""
      const accessToken = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : null

      if (accessToken) {
        const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
        if (error) {
          return NextResponse.json(
            { ok: false, error: `Auth (bearer) failed: ${error.message}` },
            { status: 401 },
          )
        }
        user = data.user ?? null
      }
    }

    if (!user?.id) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 },
      )
    }

    const { data: agent, error: agentErr } = await supabaseAdmin
      .from("agents")
      .select("telnyx_credential_id, sip_username, sip_password")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (agentErr) {
      return NextResponse.json(
        { ok: false, error: agentErr.message },
        { status: 500 },
      )
    }

    if (!agent) {
      return NextResponse.json(
        { ok: false, error: "Agent record not found" },
        { status: 404 },
      )
    }

    const sipUsername = agent?.sip_username ? String(agent.sip_username).trim() : ""
    if (!sipUsername) {
      return NextResponse.json(
        {
          ok: true,
          token: null,
          sip_username: null,
          sip_password: agent?.sip_password ?? null,
        },
        { headers: { "Cache-Control": "no-store" } },
      )
    }

    if (!agent?.telnyx_credential_id) {
      return NextResponse.json(
        { ok: false, error: "Agent missing Telnyx credential id" },
        { status: 400 },
      )
    }

    const { token } = await createWebRTCToken(agent.telnyx_credential_id)

    return NextResponse.json(
      {
        ok: true,
        token,
        sip_username: sipUsername,
        sip_password: agent?.sip_password ?? null,
        login: process.env.TELNYX_USERNAME, password:process.env.TELNYX_PASSWORD
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to create Telnyx token" },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 })
}
