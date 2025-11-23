import { supabase } from "@/lib/supabase"

export const ALLOWED_MMS_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".m4a",
  ".mp3",
  ".wav",
  ".ogg",
  ".oga",
  ".opus",
  ".amr",
  ".webm",
  ".weba",
  ".mp4",
  ".mov",
  ".avi",
  ".wmv",
  ".mkv",
  ".mpg",
  ".mpeg",
  ".ogv",
  ".3gp",
  ".3gpp",
] as const

export const MAX_MMS_SIZE = 1 * 1024 * 1024
export const MEDIA_BUCKET = "public-media"

export function getMediaBaseUrl() {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/`
}

export function isPublicMediaUrl(url: string): boolean {
  return url.startsWith(getMediaBaseUrl())
}

export function getStoragePathFromUrl(url: string): string | null {
  if (!isPublicMediaUrl(url)) return null
  return url.replace(getMediaBaseUrl(), "").split("?")[0]
}

export async function uploadMediaFile(
  file: File,
  direction: "incoming" | "outgoing" = "outgoing",
): Promise<string> {
  const result = await uploadMediaFileWithMeta(file, direction)
  return result.url
}

export async function uploadMediaFileWithMeta(
  file: File,
  direction: "incoming" | "outgoing" = "outgoing",
): Promise<{ url: string; storagePath: string; contentType: string }> {
  const ext = file.name.split(".").pop() || "bin"
  const key = `${direction}/${Date.now()}_${crypto.randomUUID()}.${ext}`

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(key, file, { upsert: true, contentType: file.type || undefined })

  if (error) {
    console.error("[uploadMediaFile] Supabase upload error", error)
    throw new Error(
      error.message ||
        "Media upload failed. Check your Supabase Storage policies for this bucket.",
    )
  }

  const storagePath = data?.path || key
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${storagePath}`

  return {
    url,
    storagePath,
    contentType: file.type || "application/octet-stream",
  }
}
