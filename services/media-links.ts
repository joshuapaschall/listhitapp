import { supabaseAdmin } from "@/lib/supabase"
import { getStoragePathFromUrl, MEDIA_BUCKET } from "@/utils/uploadMedia"
import { nanoid } from "nanoid"

function getBaseUrl() {
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (!base) {
    throw new Error("NEXT_PUBLIC_MEDIA_BASE_URL or NEXT_PUBLIC_APP_URL not set")
  }
  return base.replace(/\/+$/, "")
}

function normalizeStoragePath(storagePath: string) {
  const fromUrl = getStoragePathFromUrl(storagePath)
  if (fromUrl) return fromUrl

  const withoutBucket = storagePath
    .replace(/^\/+/, "")
    .replace(new RegExp(`^${MEDIA_BUCKET}/`), "")

  return withoutBucket.replace(/^\/+/, "")
}

export async function createShortMediaLink(
  storagePath: string,
  contentType: string,
) {
  const normalizedStoragePath = normalizeStoragePath(storagePath)

  if (!supabaseAdmin) {
    const res = await fetch("/api/media-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath: normalizedStoragePath, contentType }),
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
    .insert({ id, storage_path: normalizedStoragePath, content_type: contentType })

  if (error) throw error

  return `${baseUrl}/m/${id}`
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
