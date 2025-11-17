export const runtime = "nodejs"

import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { supabaseAdmin } from "@/lib/supabase"
import { assertVoiceEnv } from "@/lib/env-check"
import { createWebRTCToken } from "@/lib/telnyx/credentials"
import { devBypassAgentAuth } from "@/lib/dev"

function getAgentIdFromCookie(): string | null {
  const raw = cookies().get("agent_session")?.value || ""
  if (!raw) return null
  const [id] = raw.split(":")
  return id || null
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    )
  }

  const pathId = ctx.params.id
  const cookieId = devBypassAgentAuth ? pathId : getAgentIdFromCookie()

  if (!cookieId || cookieId !== pathId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: agent, error: findErr } = await supabaseAdmin
    .from("agents")
    .select("id,email,sip_username,telnyx_credential_id")
    .eq("id", cookieId)
    .maybeSingle()

  if (findErr) {
    return NextResponse.json(
      { error: "Failed to load agent" },
      { status: 500 },
    )
  }

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  if (!agent.sip_username || !agent.telnyx_credential_id) {
    return NextResponse.json(
      { error: "Agent missing Telnyx credential" },
      { status: 400 },
    )
  }

  try {
    assertVoiceEnv()
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  try {
    const token = await createWebRTCToken(agent.telnyx_credential_id)
    return NextResponse.json({ ok: true, token: token.token, sip_username: agent.sip_username })
  } catch (error: any) {
    const message = error?.message || "Failed to create Telnyx token"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function POST() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 })
}
