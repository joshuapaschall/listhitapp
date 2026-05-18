import { NextRequest, NextResponse } from "next/server"
import { getShortLinkClicks } from "@/services/shortlink-service"

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key")
  if (!key) {
    return NextResponse.json({ error: "key parameter required" }, { status: 400 })
  }
  try {
    const clicks = await getShortLinkClicks(key)
    return NextResponse.json({ clicks })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch clicks"
    console.error("[/api/short-links/clicks] failed:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
