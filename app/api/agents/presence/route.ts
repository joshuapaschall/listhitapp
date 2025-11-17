import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch (error) {
    return NextResponse.json({ error: "bad payload" }, { status: 400 })
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("status" in payload) ||
    !("client_id" in payload) ||
    !("sip_username" in payload)
  ) {
    return NextResponse.json({ error: "bad payload" }, { status: 400 })
  }

  const { status, client_id, sip_username } = payload as {
    status: string
    client_id: string
    sip_username: string
  }

  if (
    typeof client_id !== "string" ||
    typeof sip_username !== "string" ||
    !["online", "offline"].includes(status)
  ) {
    return NextResponse.json({ error: "bad payload" }, { status: 400 })
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()

  if (agentError || !agent) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 })
  }

  const { error } = await supabase.from("agents_sessions").upsert({
    agent_id: agent.id,
    sip_username,
    status,
    client_id,
    last_seen: new Date().toISOString(),
  })

  if (error) {
    console.error("presence upsert error", error)
  }

  return NextResponse.json({ ok: true })
}
