import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { ensureFfmpegAvailable } from "@/utils/ffmpeg-path"
import { mirrorMediaUrl } from "@/utils/mms.server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const { user, orgId } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const { url, direction = "incoming" } = body

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url required" }, { status: 400 })
  }

  const ffmpegBinary = await ensureFfmpegAvailable()

  if (!ffmpegBinary) {
    console.warn("[/api/media/convert] FFmpeg not available, returning original URL")
    return NextResponse.json({ url, converted: false })
  }

  try {
    const out = await mirrorMediaUrl(url, direction)
    if (!out) throw new Error("convert failed")
    return NextResponse.json({ url: out, converted: true })
  } catch (err) {
    console.error("[/api/media/convert] mirrorMediaUrl failed, falling back", err)
    return NextResponse.json({ url, converted: false })
  }
}
