import { NextResponse } from "next/server"

import { TELNYX_API_URL, getTelnyxApiKey } from "@/lib/voice-env"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const key = getTelnyxApiKey()
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Missing TELNYX_API_KEY" },
      { status: 500 }
    )
  }

  try {
    const resp = await fetch(`${TELNYX_API_URL}/connections?page[size]=100`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    })

    const json = await resp.json()
    if (!resp.ok) {
      const errorDetail = json?.errors?.[0]?.detail || json
      return NextResponse.json(
        { ok: false, status: resp.status, error: errorDetail },
        { status: resp.status }
      )
    }

    const rows = (json?.data || []).map((connection: any) => ({
      id: connection.id,
      name: connection.name,
      type: connection.connection_type || connection.type || connection.record_type,
      active: connection.active ?? true,
    }))

    return NextResponse.json({ ok: true, connections: rows })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || String(error) },
      { status: 500 }
    )
  }
}
