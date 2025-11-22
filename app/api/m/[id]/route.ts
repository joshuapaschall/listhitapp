import { NextRequest } from "next/server"
import { resolveMediaLink } from "@/services/media-links"
import { supabaseAdmin } from "@/lib/supabase"
import { MEDIA_BUCKET } from "@/utils/uploadMedia"

export const runtime = "nodejs"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (!supabaseAdmin) {
      throw new Error("supabaseAdmin not available")
    }

    const { id } = params
    const record = await resolveMediaLink(id)

    const { data, error } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .download(record.storage_path)

    if (error || !data) {
      return new Response("Not found", { status: 404 })
    }

    const buf = Buffer.from(await data.arrayBuffer())

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": record.content_type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (err) {
    console.error(err)
    return new Response("Internal error", { status: 500 })
  }
}
