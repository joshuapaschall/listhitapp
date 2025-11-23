import { supabaseAdmin } from "@/lib/supabase"
import { getTelnyxApiKey } from "@/lib/voice-env"
import { Buffer } from "buffer"
import { randomUUID } from "crypto"
import { assertServer } from "@/utils/assert-server"
import { convertToMp3 } from "./audio-utils"
import { convertToMp4 } from "./video-utils"
import {
  MEDIA_BUCKET,
  getMediaBaseUrl,
  isPublicMediaUrl,
} from "./uploadMedia"

function buildHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = {}
  const isTelnyx = /^https:\/\/[^/]*telnyx\.com\//i.test(url)
  const apiKey = getTelnyxApiKey()
  if (isTelnyx && apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`
  }
  return headers
}

async function uploadBuffer(
  buffer: Buffer,
  contentType: string,
  ext: string,
  direction: "incoming" | "outgoing",
): Promise<string> {
  const fileName = `${direction}/${randomUUID()}${ext}`
  const { data, error } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(fileName, buffer, { contentType, upsert: true })

  if (error || !data) {
    throw new Error("Supabase upload failed")
  }

  return (
    supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(data.path).data
      .publicUrl || `${getMediaBaseUrl()}${data.path}`
  )
}

export async function uploadOriginalToSupabase(
  url: string,
  direction: "incoming" | "outgoing" = "incoming",
): Promise<string> {
  assertServer()
  const headers = buildHeaders(url)
  const res = await fetch(url, Object.keys(headers).length ? { headers } : {})

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`)
  }

  const array = await res.arrayBuffer()
  const buffer = Buffer.from(array)
  const contentType =
    res.headers.get("content-type")?.toLowerCase() || "application/octet-stream"
  let ext = url.split("?")[0].match(/\.[^./]+$/)?.[0]?.toLowerCase() || ""

  if (!ext && contentType.includes("/")) {
    const subtype = contentType.split("/")[1]?.split(";")[0]
    if (subtype) ext = `.${subtype}`
  }

  return uploadBuffer(buffer, contentType, ext, direction)
}

export async function mirrorMediaUrl(
  inputUrl: string,
  direction: "incoming" | "outgoing" = "incoming",
): Promise<string | null> {
  assertServer()

  const headers = buildHeaders(inputUrl)
  const res = await fetch(
    inputUrl,
    Object.keys(headers).length ? { headers } : {},
  )

  if (!res.ok) {
    console.error("❌ Telnyx media fetch error", res.status)
    return null
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType =
    res.headers.get("content-type")?.toLowerCase() || "application/octet-stream"
  let ext = inputUrl.split("?")[0].match(/\.[^./]+$/)?.[0]?.toLowerCase() || ""

  if (!ext && contentType.includes("/")) {
    const subtype = contentType.split("/")[1]?.split(";")[0]
    if (subtype) ext = `.${subtype}`
  }

  const isImage = contentType.startsWith("image/")
  const audioExts = [".weba", ".3gp", ".wav", ".ogg", ".oga", ".opus", ".amr", ".webm"]
  const videoExts = [".mp4", ".3gpp", ".3gp", ".mov", ".webm"]
  const isAudioExt = ext ? audioExts.includes(ext) : false
  const isAudio = contentType.startsWith("audio/") || isAudioExt
  const isVideo =
    !isAudio && (contentType.startsWith("video/") || (ext ? videoExts.includes(ext) : false))

  try {
    if (isImage) {
      return uploadBuffer(buffer, contentType, ext, direction)
    }

    if (isAudio) {
      const converted = await convertToMp3(inputUrl, direction, buffer)
      return converted
    }

    if (isVideo) {
      try {
        const converted = await convertToMp4(inputUrl, direction, buffer)
        return converted
      } catch (err) {
        console.error("❌ convertToMp4 failed", err)
        if (direction === "incoming") {
          try {
            return await uploadBuffer(buffer, "video/mp4", ".mp4", direction)
          } catch (uploadErr) {
            console.error("❌ Failed to upload original after video conversion error", uploadErr)
          }
        }
        throw err
      }
    }

    return uploadBuffer(buffer, contentType, ext, direction)
  } catch (err) {
    console.error("mirrorMediaUrl error:", err)
    return null
  }
}

export async function ensurePublicMediaUrls(
  urls: string[],
  direction: "incoming" | "outgoing" = "incoming",
): Promise<string[]> {
  assertServer()
  const result: string[] = []

  for (const url of urls) {
    if (url.startsWith("blob:")) {
      throw new Error("Blob URLs not supported")
    }

    if (isPublicMediaUrl(url)) {
      const ext = url.split("?")[0].match(/\.[^./]+$/)?.[0]?.toLowerCase()
      const isOutgoingMov =
        direction === "outgoing" && ext === ".mov" && url.includes("/outgoing/")

      if (isOutgoingMov) {
        const converted = await convertToMp4(url, "outgoing")
        result.push(converted)
        continue
      }

      result.push(url)
      continue
    }

    const mirrored = await mirrorMediaUrl(url, direction)
    if (mirrored) {
      result.push(mirrored)
    }
  }

  return result
}
