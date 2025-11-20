import { supabaseAdmin } from "@/lib/supabase"
import { getTelnyxApiKey } from "@/lib/voice-env"
import { randomUUID } from "crypto"
import { PassThrough } from "stream"
import { assertServer } from "@/utils/assert-server"
import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static" // ✅ NEW: Use ffmpeg-static instead of public/bin/ffmpeg

import {
  MEDIA_BUCKET,
  MAX_MMS_SIZE,
  getMediaBaseUrl,
  isPublicMediaUrl,
} from "./uploadMedia"

// ✅ Set ffmpeg path using ffmpeg-static when available
if (typeof (ffmpeg as any).setFfmpegPath === "function") {
  ffmpeg.setFfmpegPath(ffmpegPath || "")
}

export async function convertToMp3(
  inputUrl: string,
  direction: "incoming" | "outgoing" = "incoming",
  buffer?: Buffer,
): Promise<string> {
  assertServer()

  const headers: Record<string, string> = {}
  const isTelnyx = /^https:\/\/[^/]*telnyx\.com\//i.test(inputUrl)

  let buf: Buffer
  if (buffer) {
    buf = buffer
  } else {
    const apiKey = getTelnyxApiKey()
    if (isTelnyx && apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`
    }

    const res = await fetch(
      inputUrl,
      Object.keys(headers).length ? { headers } : {},
    )
    if (!res.ok) {
      throw new Error(`Failed to fetch ${inputUrl}: ${res.status}`)
    }

    buf = Buffer.from(await res.arrayBuffer())
  }

  const mp3 = await new Promise<Buffer>((resolve, reject) => {
    const input = new PassThrough()
    input.end(buf)
    const chunks: Buffer[] = []

    ffmpeg(input)
      .toFormat("mp3")
      .on("error", reject)
      .on("end", () => resolve(Buffer.concat(chunks)))
      .pipe()
      .on("data", (d: Buffer) => chunks.push(d))
  })

  if (mp3.length > MAX_MMS_SIZE) {
    throw new Error("Converted audio exceeds the 1MB MMS limit")
  }

  const fileName =
    direction === "incoming"
      ? `incoming/${Date.now()}_${randomUUID()}.mp3`
      : `outgoing/${Date.now()}_${randomUUID()}.mp3`

  const { data, error } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(fileName, mp3, {
      contentType: "audio/mpeg",
      upsert: true,
    })

  if (error || !data) {
    throw new Error("Supabase upload failed")
  }

  const publicUrl =
    supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(data.path).data
      .publicUrl || `${getMediaBaseUrl()}${data.path}`

  if (isPublicMediaUrl(inputUrl)) {
    const originalPath = inputUrl
      .replace(getMediaBaseUrl(), "")
      .split("?")[0]
    await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([originalPath])
  }

  return publicUrl
}
