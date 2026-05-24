import { NextResponse } from "next/server"

import { supabaseAdmin } from "@/lib/supabase"
import {
  getCallControlAppId,
  getSipCredentialConnectionId,
  getTelnyxApiKey,
} from "@/lib/voice-env"

export async function GET() {
  const callControlAppId = getCallControlAppId()
  const sipCredentialConnectionId = getSipCredentialConnectionId()
  const flags = {
    telnyxApiKey: !!getTelnyxApiKey(),
    callControlAppId: !!callControlAppId,
    sipCredentialConnectionId: !!sipCredentialConnectionId,
    fromNumber: !!process.env.FROM_NUMBER,
  }
  const env = {
    TELNYX_API_KEY: flags.telnyxApiKey,
    CALL_CONTROL_APP_ID: flags.callControlAppId,
    SIP_CREDENTIAL_CONNECTION_ID: flags.sipCredentialConnectionId,
    FROM_NUMBER: flags.fromNumber,
  }

  let agent: { id: string; sip_username: string | null } | null = null
  let supabaseError: Error | null = null

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("agents")
      .select("id, sip_username")
      .limit(1)
      .maybeSingle()

    agent = data ?? null
    supabaseError = error
  } else {
    supabaseError = new Error("SUPABASE_SERVICE_ROLE_KEY missing")
  }

  let lastPresencePing: string | null = null

  if (agent?.id && supabaseAdmin) {
    try {
      const { data: presence } = await supabaseAdmin
        .from("agents_sessions")
        .select("last_seen")
        .eq("agent_id", agent.id)
        .order("last_seen", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (presence?.last_seen) {
        lastPresencePing = presence.last_seen
      }
    } catch (presenceError) {
      console.error("[health] failed to load last presence", presenceError)
    }
  }

  return NextResponse.json({
    ok: true,
    flags,
    env,
    callControlAppId_present: !!callControlAppId,
    sipCredentialConnectionId_present: !!sipCredentialConnectionId,
    callControlAppId_preview: callControlAppId ? `${callControlAppId}` : null,
    sipCredentialConnectionId_preview: sipCredentialConnectionId
      ? `${sipCredentialConnectionId}`
      : null,
    supabase_ok: !supabaseError,
    supabase_error: supabaseError?.message,
    agent: {
      id: agent?.id ?? null,
      has_sip_username: !!agent?.sip_username,
      sip_username: agent?.sip_username ?? null,
    },
    last_presence_ping: lastPresencePing,
  })
}
