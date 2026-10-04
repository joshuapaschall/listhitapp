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

    const contentType = record.content_type || "application/octet-stream"
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      // Never let the browser sniff a stored blob into something executable.
      "X-Content-Type-Options": "nosniff",
    }
    // Only media the carrier/recipient is meant to view inline renders inline;
    // everything else (PDFs included) downloads instead of rendering in-origin.
    if (!/^(image|video|audio)\//i.test(contentType)) {
      headers["Content-Disposition"] = "attachment"
    }

    return new Response(buffer, {
      status: 200,
      headers,
    })
  } catch (err: any) {
    console.error("Error in /api/m route", err)
    if (String(err?.message || "").toLowerCase().includes("not found")) {
      return new Response("Not found", { status: 404 })
    }
    return new Response("Internal error", { status: 500 })
  }
}
