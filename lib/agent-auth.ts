import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

import { supabaseAdmin } from "./supabase/index"
import { devBypassAgentAuth } from "./dev"

export async function requireAgent() {
  if (devBypassAgentAuth) {
    return {
      id: "dev",
      email: "dev@local",
      display_name: "Dev Agent",
      sip_username: null,
    }
  }

  if (!supabaseAdmin) throw new Error("Server missing SUPABASE_SERVICE_ROLE_KEY")

  const cookieStore = cookies()
  const routeClient = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
    error,
  } = await routeClient.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  if (!user) {
    throw new Error("Unauthorized")
  }

  const { data: agent, error: agentError } = await supabaseAdmin
    .from("agents")
    .select("id, email, display_name, sip_username, auth_user_id, telephony_credential_id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (agentError || !agent) throw new Error("Unauthorized")

  return agent
}
