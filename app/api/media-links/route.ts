import { NextRequest } from "next/server"
import { createShortMediaLink } from "@/services/media-links"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { storagePath, contentType } = await req.json()
    if (!storagePath || !contentType) {
      return new Response("storagePath and contentType required", { status: 400 })
    }

    const shortUrl = await createShortMediaLink(storagePath, contentType)
    return Response.json({ shortUrl })
  } catch (err: any) {
    console.error(err)
    return new Response(err?.message || "Failed to create media link", { status: 500 })
  }
}
