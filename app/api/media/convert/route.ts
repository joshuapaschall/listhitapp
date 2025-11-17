import { NextRequest } from "next/server"
import { mirrorMediaUrl } from "@/utils/mms.server"

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
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 })
  }
}
