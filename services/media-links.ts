import { supabaseAdmin } from "@/lib/supabase"
import { nanoid } from "nanoid"

function getBaseUrl() {
  const rawBase =
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL

  if (!rawBase) {
    throw new Error("No base URL configured for media links")
  }

  return rawBase.replace(/\/+$/, "")
}

export async function createShortMediaLink(
  storagePath: string,
  contentType: string,
): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error("supabaseAdmin is not initialized")
  }

  const id = nanoid(8)

  const { error } = await supabaseAdmin
    .from("media_links")
    .insert({
      id,
      storage_path: storagePath,
      content_type: contentType,
    })

  if (error) {
    console.error("Failed to insert media_links row", error)
    throw new Error("Failed to create media link")
  }

  const base = getBaseUrl()
  // IMPORTANT: we link directly to the API route, not a page
  return `${base}/api/m/${id}`
}

export async function resolveMediaLink(
  id: string,
): Promise<{ storage_path: string; content_type: string }> {
  if (!supabaseAdmin) {
    throw new Error("supabaseAdmin is not initialized")
  }

  const { data, error } = await supabaseAdmin
    .from("media_links")
    .select("storage_path, content_type")
    .eq("id", id)
    .single()

  if (error || !data) {
    console.error("Failed to resolve media link", error)
    throw new Error("Media link not found")
  }

  return data
}
