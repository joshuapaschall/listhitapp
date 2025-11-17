import { NextRequest, NextResponse } from "next/server"
import { mirrorMediaUrl } from "@/utils/mms.server"

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) {
    return NextResponse.json({ error: "url query required" }, { status: 400 })
  }
  const mirrored = await mirrorMediaUrl(url, "incoming")
  if (!mirrored) {
    return NextResponse.json({ error: "Failed to mirror media" }, { status: 500 })
  }
  return NextResponse.json({ mirroredUrl: mirrored })
}
