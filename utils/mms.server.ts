import { supabaseAdmin } from "@/lib/supabase"
import { getTelnyxApiKey } from "@/lib/voice-env"
import { Buffer } from "buffer"
import { randomUUID } from "crypto"
import { assertServer } from "@/utils/assert-server"
import { convertToMp3 } from "./audio-utils"
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
    const contentType =
      res.headers.get("content-type") || "application/octet-stream"
    const originalExt = url.split("?")[0].match(/\.[^./]+$/)?.[0]?.toLowerCase()

    const convertible =
      contentType.includes("amr") ||
      contentType.includes("3gpp") ||
      contentType.includes("webm") ||
      contentType.includes("ogg") ||
      contentType.includes("opus") ||
      contentType.includes("wav") ||
      contentType.includes("m4a") ||
      [".amr", ".3gp", ".webm", ".ogg", ".oga", ".opus", ".wav", ".m4a"].includes(
        originalExt || ""
      )

    if (convertible) {
      try {
        return await convertToMp3(url, direction, buffer)
      } catch (err) {
        console.error("❌ convertToMp3 failed:", err)
        return null
      }
    }

    return await uploadOriginalToSupabase(url, direction)
  } catch (err) {
    console.error("mirrorMediaUrl error:", err)
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

    const ext = u.split("?")[0].match(/\.[^./]+$/)?.[0]?.toLowerCase() || ""
    const needsConvert =
      /(\.amr|\.3gp|\.webm|\.weba|\.ogg|\.oga|\.opus|\.wav|\.m4a)$/i.test(ext)

    if (isPublicMediaUrl(u) && !needsConvert) {
      result.push(u)
      continue
    }

    const mirrored = await mirrorMediaUrl(u, direction)
    if (!mirrored) {
      console.warn("⚠️ Failed to mirror media:", u)
      continue
    }

    result.push(mirrored)
  }

  return result
}
