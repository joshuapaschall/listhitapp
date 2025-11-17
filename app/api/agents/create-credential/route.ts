export const runtime = "nodejs"
import { NextRequest, NextResponse } from "next/server"

import { supabaseAdmin } from "@/lib/supabase"
import { requireAgent } from "@/lib/agent-auth"
import {
  SipCredentialConnectionError,
  createAgentTelephonyCredential,
} from "@/lib/telnyx/credentials"
import {
  getCallControlAppId,
  getSipCredentialConnectionId,
} from "@/lib/voice-env"

export async function POST(_request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    )
  }
  try {
    const sipConnectionId = getSipCredentialConnectionId()

    if (!sipConnectionId) {
      return NextResponse.json(
        {
          error: "Missing SIP credential connection id (TELNYX_SIP_CONNECTION_ID).",
        },
        { status: 500 },
      )
    }

    const callControlAppId = getCallControlAppId()

    if (callControlAppId && callControlAppId === sipConnectionId) {
      console.warn(
        "WARN: TELNYX_SIP_CONNECTION_ID equals CALL_CONTROL_APP_ID — misconfiguration likely.",
      )
    }

    const agent = await requireAgent()

    if (agent.telephony_credential_id) {
      return NextResponse.json({
        message: "Agent already has a credential",
        credential_id: agent.telephony_credential_id,
      })
    }

    console.log("🔐 Creating telephony credential for agent:", agent.email)

    const credential = await createAgentTelephonyCredential({
      sipUsername: agent.sip_username || undefined,
    })

    const { error: updateError } = await supabaseAdmin
      .from("agents")
      .update({
        telephony_credential_id: credential.id,
        sip_username: credential.username,
        sip_password: credential.password,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agent.id)

    if (updateError) {
      console.error("❌ Failed to update agent:", updateError)
      throw updateError
    }

    return NextResponse.json({
      message: "Telephony credential created successfully",
      credential_id: credential.id,
    })
  } catch (err: any) {
    console.error("[agents] route error:", err)
    const status = err instanceof SipCredentialConnectionError ? err.status : 500
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status },
    )
  }
}
