import { NextResponse } from "next/server"

import {
  TELNYX_API_URL,
  getCallControlAppId,
  getSipCredentialConnectionId,
  getTelnyxApiKey,
} from "@/lib/voice-env"

export async function GET() {
  const apiKey = getTelnyxApiKey()
  const connectionId = getSipCredentialConnectionId()

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Missing TELNYX_API_KEY" },
      { status: 500 },
    )
  }

  if (!connectionId) {
    return NextResponse.json(
      { ok: false, error: "Missing SIP credential connection id (TELNYX_SIP_CONNECTION_ID)." },
      { status: 500 },
    )
  }

  const callControlAppId = getCallControlAppId()

  if (callControlAppId && callControlAppId === connectionId) {
    console.warn(
      "WARN: TELNYX_SIP_CONNECTION_ID equals CALL_CONTROL_APP_ID — misconfiguration likely.",
    )
  }

  const url =
    `${TELNYX_API_URL}/telephony_credentials?filter[connection_id]=${encodeURIComponent(connectionId)}&page[size]=100`

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  const json = await resp.json().catch(() => ({}))

  if (!resp.ok) {
    const errorMessage = json?.errors?.[0]?.detail || json
    return NextResponse.json(
      { ok: false, status: resp.status, error: errorMessage },
      { status: resp.status },
    )
  }

  const credentials = (json?.data || []).map((cred: any) => ({
    id: cred.id,
    username: cred.username,
    connection_id: cred.connection_id,
  }))

  return NextResponse.json({ ok: true, credentials })
}
