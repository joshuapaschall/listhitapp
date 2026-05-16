import { NextResponse } from "next/server"

import { TELNYX_API_URL, getTelnyxApiKey } from "@/lib/voice-env"

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "")
  if (!token || token !== process.env.ADMIN_TASKS_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const key = getTelnyxApiKey()
  const { searchParams } = new URL(request.url)
  const cred = searchParams.get("cred")

  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Missing TELNYX_API_KEY" },
      { status: 500 },
    )
  }

  if (!cred) {
    return NextResponse.json(
      { ok: false, error: "Provide ?cred=<telephony_credential_id>" },
      { status: 400 },
    )
  }

  const url = `${TELNYX_API_URL}/telephony_credentials/${encodeURIComponent(
    cred,
  )}/token`

  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
  })

  const raw = await resp.text().catch(() => "")
  let json: any = null
  try {
    json = raw ? JSON.parse(raw) : null
  } catch {
    json = null
  }

  return NextResponse.json({ ok: resp.ok, status: resp.status, json, raw })
}
