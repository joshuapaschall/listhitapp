import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const secret = process.env.VOICE_SYNC_SECRET_KEY
  if (!secret) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.DISPOTOOL_BASE_URL ||
    request.nextUrl.origin

  try {
    const res = await fetch(`${baseUrl}/api/sync/voice-numbers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    })
    const text = await res.text()
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("Internal sync failed", err)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    )
  }
}

export async function GET() {
  return new Response(JSON.stringify({ message: "Use POST" }), {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "application/json" },
  })
}
