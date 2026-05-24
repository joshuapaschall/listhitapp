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

  const supabaseError: Error | null = supabaseAdmin
    ? null
    : new Error("SUPABASE_SERVICE_ROLE_KEY missing")

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
      id: null,
      has_sip_username: false,
      sip_username: null,
    },
    last_presence_ping: null,
  })
}
