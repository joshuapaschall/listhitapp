import { NextRequest } from "next/server"
import { getShortLinkClicks } from "@/services/shortio-service"

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key")
  if (!key) {
    return new Response(JSON.stringify({ error: "key required" }), { status: 400 })
  }
  try {
    const clicks = await getShortLinkClicks(key)
    return new Response(JSON.stringify({ clicks }))
  } catch (err: any) {
    console.error("Short.io stats failed", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 })
  }
}
