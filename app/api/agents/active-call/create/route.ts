export const runtime = "nodejs"
import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { v4 as uuidv4 } from "uuid"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    )
  }
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    let {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      const authHeader = request.headers.get("authorization") || ""
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
      .select("id,telnyx_credential_id, sip_username, sip_password")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    const agentId = agent?.id;
    const { callControlId } = await request.json()

    console.log("📝 Creating agent_active_calls record")
    console.log("  - Agent ID:", agentId)
    console.log("  - Call Control ID:", callControlId)

    if (!agentId || !callControlId) {
      return NextResponse.json(
        { error: "Missing agentId or callControlId" },
        { status: 400 }
      )
    }

    const recordId = uuidv4()

    const { data, error } = await supabaseAdmin
      .from("agent_active_calls")
      .upsert(
        {
          id: recordId,
          agent_id: agentId,
          agent_leg_id: callControlId,
          hold_state: "active",
          playback_state: "idle",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'agent_id',
          ignoreDuplicates: false,
        },
      )
      .select()
      .single()

    if (error) throw error

    console.log("✅ Active call record created:", data)

    return NextResponse.json({
      success: true,
      message: "Active call record created",
      data,
    })
  } catch (err: any) {
    console.error("[agents] route error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    )
  }
}
