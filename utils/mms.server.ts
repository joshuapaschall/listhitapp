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

export async function uploadOriginalToSupabase(
  url: string,
  direction: "incoming" | "outgoing" = "incoming"
): Promise<string | null> {
  assertServer()
  try {
    const isTelnyx = /^https:\/\/[^/]*telnyx\.com\//i.test(url)
    const headers: Record<string, string> = {}
    const apiKey = getTelnyxApiKey()
    if (isTelnyx && apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`
    }

    const res = await fetch(url, Object.keys(headers).length ? { headers } : {})
    if (!res.ok) {
      console.error("❌ Failed to fetch Telnyx media:", res.status)
      return null
    }

    const array = await res.arrayBuffer()
    const contentType =
      res.headers.get("content-type") || "application/octet-stream"
    let ext = url.split("?")[0].match(/\.[^./]+$/)?.[0] || ""

    if (!ext && contentType.includes("/")) {
      const subtype = contentType.split("/")[1]?.split(";")[0] || ""
      if (subtype) ext = `.${subtype}`
    }

    const fileName =
      direction === "incoming"
        ? `incoming/${Date.now()}_${randomUUID()}${ext}`
        : `outgoing/${Date.now()}_${randomUUID()}${ext}`

    const { data, error } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .upload(fileName, Buffer.from(array), { contentType, upsert: true })

    if (error || !data) {
      console.warn("⚠️ Raw upload Supabase error", error)
      return null
    }

    return (
      supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(data.path).data
        .publicUrl || `${getMediaBaseUrl()}${data.path}`
    )
  } catch (err) {
    console.warn("⚠️ Direct upload exception", err)
    return null
  }
}

export async function mirrorMediaUrl(
  url: string,
  direction: "incoming" | "outgoing" = "outgoing"
): Promise<string | null> {
  assertServer()
  let attemptedConvert = false
  let contentType = "application/octet-stream"
  try {
    const isTelnyx = /^https:\/\/[^/]*telnyx\.com\//i.test(url)
    const headers: Record<string, string> = {}
    const apiKey = getTelnyxApiKey()
    if (isTelnyx && apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`
    }

    const res = await fetch(url, Object.keys(headers).length ? { headers } : {})
    if (!res.ok) {
      console.error("❌ Telnyx media fetch error", res.status)
      return null
    }

    const array = await res.arrayBuffer()
    const buffer = Buffer.from(array)
    contentType =
      res.headers.get("content-type")?.toLowerCase() || "application/octet-stream"
    const originalExt = url.split("?")[0].match(/\.[^./]+$/)?.[0]?.toLowerCase()

    const videoExtensions = [
      ".mp4",
      ".mov",
      ".3gp",
      ".3gpp",
      ".webm",
      ".avi",
      ".wmv",
      ".mkv",
      ".mpg",
      ".mpeg",
      ".ogv",
    ]
    const videoContentTypes = [
      "video/mp4",
      "video/quicktime",
      "video/3gpp",
      "video/3gp",
      "video/webm",
      "video/ogg",
      "video/mpeg",
      "video/x-msvideo",
      "video/x-ms-wmv",
    ]
    const isAudioContent = contentType.startsWith("audio/")
    const isVideo =
      !isAudioContent &&
      (videoContentTypes.some((ct) => contentType.startsWith(ct)) ||
        (originalExt ? videoExtensions.includes(originalExt) : false))

    const needsVideoConversion =
      isVideo &&
      ((originalExt ? originalExt !== ".mp4" : false) ||
        !contentType.startsWith("video/mp4"))

    const convertibleExts = [
      ".amr",
      ".3gp",
      ".3gpp",
      ".webm",
      ".weba",
      ".ogg",
      ".oga",
      ".opus",
      ".wav",
      ".m4a",
    ]
    const convertibleContentTypes = [
      "audio/amr",
      "audio/3gpp",
      "audio/3gp",
      "audio/webm",
      "audio/ogg",
      "application/ogg",
      "audio/opus",
      "audio/wav",
      "audio/x-wav",
      "audio/m4a",
      "audio/mp4",
    ]

    const convertible =
      !isVideo &&
      (convertibleContentTypes.some((ct) => contentType.includes(ct.replace("audio/", ""))) ||
        (originalExt ? convertibleExts.includes(originalExt) : false))

    if (needsVideoConversion) {
      attemptedConvert = true
      try {
        return await convertToMp4(url, direction, buffer)
      } catch (err) {
        console.error("❌ convertToMp4 failed", {
          error: err,
          url,
          contentType,
        })
        if (direction === "incoming") {
          console.warn("⚠️ Falling back to original URL after failed video conversion", {
            url,
            contentType,
          })
          return url
        }
        throw err
      }
    }

    if (isVideo) {
      return await uploadOriginalToSupabase(url, direction)
    }

    if (convertible) {
      attemptedConvert = true
      try {
        return await convertToMp3(url, direction, buffer)
      } catch (err) {
        console.error("❌ convertToMp3 failed", {
          error: err,
          url,
          contentType,
        })
        if (direction === "incoming") {
          console.warn("⚠️ Falling back to original URL after failed conversion", {
            url,
            contentType,
          })
          return url
        }
        throw err
      }
    }

    return await uploadOriginalToSupabase(url, direction)
  } catch (err) {
    console.error("mirrorMediaUrl error:", err)
    if (attemptedConvert && direction === "incoming") {
      console.warn("⚠️ Returning original URL after conversion error", {
        url,
        contentType,
      })
      return url
    }
    if (attemptedConvert) throw err
    return null
  }
}

export async function ensurePublicMediaUrls(
  urls: string[],
  direction: "incoming" | "outgoing" = "incoming"
): Promise<string[]> {
  assertServer()
  const result: string[] = []

  for (const u of urls) {
    if (u.startsWith("blob:")) {
      throw new Error("Blob URLs not supported")
    }

    const ext = u.split("?")[0].match(/\.[^./]+$/)?.[0]?.toLowerCase()
    const audioConvertibleExts = [
      ".amr",
      ".3gp",
      ".3gpp",
      ".webm",
      ".weba",
      ".ogg",
      ".oga",
      ".opus",
      ".wav",
      ".m4a",
    ]
    const needsMp4Normalization =
      ext &&
      [
        ".mov",
        ".avi",
        ".wmv",
        ".mkv",
        ".mpg",
        ".mpeg",
        ".ogv",
        ".3gp",
        ".3gpp",
        ".webm",
      ].includes(ext) &&
      !audioConvertibleExts.includes(ext)

    if (isPublicMediaUrl(u)) {
      if (needsMp4Normalization) {
        try {
          const converted = await convertToMp4(u, direction)
          result.push(converted)
          continue
        } catch (err) {
          console.error("❌ convertToMp4 failed for public media", err)
          if (direction === "incoming") {
            result.push(u)
            continue
          }
          throw err
        }
      }
      result.push(u)
      continue
    }

    let mirrored: string | null = null
    try {
      mirrored = await mirrorMediaUrl(u, direction)
    } catch (err) {
      console.error("❌ mirrorMediaUrl threw", err)
    }
    if (!mirrored) {
      console.warn("⚠️ Failed to mirror media:", u)
      if (direction === "incoming") result.push(u)
      continue
    }

    result.push(mirrored)
  }

  return result
}
