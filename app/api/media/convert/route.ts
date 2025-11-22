import { NextRequest } from "next/server"
import { mirrorMediaUrl } from "@/utils/mms.server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const { url, direction } = await req.json()
  if (!url || typeof url !== "string") {
    return new Response(JSON.stringify({ error: "url required" }), { status: 400 })
  }
  try {
    const out = await mirrorMediaUrl(url, direction || "incoming")
    if (!out) throw new Error("convert failed")
    return Response.json({ url: out })
  } catch (err: any) {
    console.error("convert error", err)
    const message =
      err?.message || "Media conversion is unavailable right now. Please retry later."
    const status = err?.message?.toLowerCase().includes("ffmpeg") ? 503 : 500
    return new Response(JSON.stringify({ error: message }), { status })
  }
}
