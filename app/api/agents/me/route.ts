export const runtime = "nodejs"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import { supabaseAdmin } from "@/lib/supabase"
import { devBypassAgentAuth } from "@/lib/dev"

export async function GET() {
  if (devBypassAgentAuth) {
    return NextResponse.json({
      id: "dev",
      email: "dev@local",
      display_name: "Dev Agent",
      sip_username: null,
      status: "available",
    })
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    )
  }

  const cookieStore = cookies()
  const routeClient = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await routeClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("id,email,display_name,sip_username,status")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: "Failed to load agent" }, { status: 500 })
  if (!agent) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  return NextResponse.json(agent)
}
