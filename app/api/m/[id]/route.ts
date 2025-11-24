import { NextRequest } from "next/server"
import { resolveMediaLink } from "@/services/media-links"
import { supabaseAdmin } from "@/lib/supabase"
import { MEDIA_BUCKET } from "@/utils/uploadMedia"
import { Buffer } from "buffer"

export const runtime = "nodejs"

type RouteParams = {
  params: { id: string }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    if (!supabaseAdmin) {
      throw new Error("supabaseAdmin is not initialized")
    }

    const id = params?.id
    if (!id) {
      return new Response("Missing id", { status: 400 })
    }

    // Look up where the file actually lives in storage
    const record = await resolveMediaLink(id) // { storage_path, content_type }

    const { data, error } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .download(record.storage_path)

    if (error || !data) {
      console.error("Failed to download media", error)
      return new Response("Not found", { status: 404 })
    }

    const buffer = Buffer.from(await data.arrayBuffer())

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": record.content_type || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (err: any) {
    console.error("Error in /api/m route", err)
    if (String(err?.message || "").toLowerCase().includes("not found")) {
      return new Response("Not found", { status: 404 })
    }
    return new Response("Internal error", { status: 500 })
  }
}
