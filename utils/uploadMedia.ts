import { supabase } from "@/lib/supabase"
import {
  convertAudioToMp3,
  convertVideoToMp4,
  needsAudioConversion,
  needsVideoConversion,
} from "@/lib/browser-ffmpeg"

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

// Storage keys are validated server-side by /api/media-links against
// /^(incoming|outgoing)\/[A-Za-z0-9._-]+$/, so the extension has to be
// alphanumeric. A file named "My Document" (no dot, a space) used to produce
// "My Document" as the extension and get the link rejected.
export function safeExtension(fileName: string, mimeType?: string): string {
  const sanitize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)

  if (fileName.includes(".")) {
    const fromName = sanitize(fileName.slice(fileName.lastIndexOf(".") + 1))
    if (fromName) return fromName
  }

  const subtype = mimeType?.split(";")[0]?.split("/")[1]
  if (subtype) {
    const fromMime = sanitize(subtype)
    if (fromMime) return fromMime
  }

  return "bin"
}

export async function uploadMediaFileWithMeta(
  file: File,
  direction: "incoming" | "outgoing" = "outgoing",
): Promise<{ url: string; storagePath: string; contentType: string }> {
  let workingFile = file

  if (typeof window !== "undefined") {
    try {
      if (needsVideoConversion(workingFile)) {
        workingFile = await convertVideoToMp4(workingFile)
      } else if (needsAudioConversion(workingFile)) {
        workingFile = await convertAudioToMp3(workingFile)
      }
    } catch (err) {
      console.error("browser ffmpeg conversion failed, using original file", err)
    }
  }

  const ext = safeExtension(workingFile.name, workingFile.type)
  const key = `${direction}/${Date.now()}_${crypto.randomUUID()}.${ext}`

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(key, workingFile, { upsert: true, contentType: workingFile.type || undefined })

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
    contentType: workingFile.type || "application/octet-stream",
  }
}
