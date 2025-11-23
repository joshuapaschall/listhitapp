import { supabaseAdmin } from "@/lib/supabase"
import { nanoid } from "nanoid"

function getBaseUrl() {
  const rawBase =
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_APP_URL

  if (!rawBase) {
    throw new Error("No base URL configured for media links")
  }

  return rawBase.replace(/\/$/, "")
}

export async function createShortMediaLink(
  storagePath: string,
  contentType: string,
) {
  if (!supabaseAdmin) {
    const res = await fetch("/api/media-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath, contentType }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.shortUrl) {
      throw new Error(data.error || "Failed to create media link")
    }
    return data.shortUrl as string
  }

  const baseUrl = getBaseUrl()

  const id = nanoid(8)

  const { error } = await supabaseAdmin
    .from("media_links")
    .insert({ id, storage_path: storagePath, content_type: contentType })

  if (error) throw error

  return `${baseUrl}/api/m/${id}`
}

export async function resolveMediaLink(id: string) {
  if (!supabaseAdmin) {
    throw new Error("supabaseAdmin not available")
  }

  const { data, error } = await supabaseAdmin
    .from("media_links")
    .select("storage_path, content_type")
    .eq("id", id)
    .single()

  if (error || !data) throw error || new Error("Media link not found")

  return data
}
