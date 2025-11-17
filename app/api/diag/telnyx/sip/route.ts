import { NextResponse } from "next/server"

import { TELNYX_API_URL, getSipCredentialConnectionId, getTelnyxApiKey } from "@/lib/voice-env"

export async function GET() {
  const id = getSipCredentialConnectionId()
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "No TELNYX_SIP_CONNECTION_ID" },
      { status: 500 },
    )
  }

  const apiKey = getTelnyxApiKey()
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Missing TELNYX_API_KEY" },
      { status: 500 },
    )
  }
  const response = await fetch(`${TELNYX_API_URL}/connections/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const data = await response.json().catch(() => ({}))

  return NextResponse.json({ ok: response.ok, status: response.status, data })
}
