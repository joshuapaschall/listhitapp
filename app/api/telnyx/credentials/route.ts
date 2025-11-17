import { NextRequest } from "next/server"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"
import { getTelnyxApiKey } from "@/lib/voice-env"

export async function GET(_req?: NextRequest) {
  const apiKey = getTelnyxApiKey()
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Telnyx not configured" }), {
      status: 500,
    })
  }

  try {
    const res = await fetch(
      `${TELNYX_API_URL}/telephony_credentials`,
      { headers: telnyxHeaders() },
    )
    const data = await res.json()
    return Response.json(data)
  } catch (err) {
    console.error("Failed to fetch Telnyx credentials", err)
    return new Response(JSON.stringify({ error: "Telnyx error" }), { status: 500 })
  }
}
