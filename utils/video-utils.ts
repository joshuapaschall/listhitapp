import { supabaseAdmin } from "@/lib/supabase"
import { getTelnyxApiKey } from "@/lib/voice-env"
import { randomUUID } from "crypto"
import { PassThrough } from "stream"
import { assertServer } from "@/utils/assert-server"
import ffmpeg from "fluent-ffmpeg"
import { ensureFfmpegAvailable } from "@/utils/ffmpeg-path"

import {
  MEDIA_BUCKET,
  MAX_MMS_SIZE,
  getMediaBaseUrl,
  isPublicMediaUrl,
} from "./uploadMedia"

export async function convertToMp4(
  inputUrl: string,
  direction: "incoming" | "outgoing" = "incoming",
  buffer?: Buffer,
): Promise<string> {
  assertServer()
  const ffmpegBinary = ensureFfmpegAvailable()
  console.log("Using FFmpeg binary for video conversion", ffmpegBinary)

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

  const mp4 = await new Promise<Buffer>((resolve, reject) => {
    const input = new PassThrough()
    input.end(buf)
    const chunks: Buffer[] = []

    ffmpeg(input)
      .videoCodec("libx264")
      .audioCodec("aac")
      .videoFilters("scale='min(640,iw)':-2")
      .toFormat("mp4")
      .outputOptions([
        "-movflags",
        "faststart",
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "baseline",
        "-level",
        "3.0",
        "-preset",
        "faster",
        "-crf",
        "30",
        "-b:v",
        "650k",
        "-maxrate",
        "750k",
        "-bufsize",
        "1000k",
        "-b:a",
        "96k",
        "-fs",
        `${MAX_MMS_SIZE}`,
      ])
      .on("error", reject)
      .on("end", () => resolve(Buffer.concat(chunks)))
      .pipe()
      .on("data", (d: Buffer) => chunks.push(d))
  })

  if (mp4.length > MAX_MMS_SIZE) {
    throw new Error("Converted video exceeds the 1MB MMS limit")
  }

  const fileName =
    direction === "incoming"
      ? `incoming/${Date.now()}_${randomUUID()}.mp4`
      : `outgoing/${Date.now()}_${randomUUID()}.mp4`

  const { data, error } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(fileName, mp4, {
      contentType: "video/mp4",
      upsert: true,
    })

  if (error || !data) {
    throw new Error("Supabase upload failed")
  }

  const publicUrl =
    supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(data.path).data
      .publicUrl || `${getMediaBaseUrl()}${data.path}`

  if (isPublicMediaUrl(inputUrl)) {
    const originalPath = inputUrl.replace(getMediaBaseUrl(), "").split("?")[0]
    await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([originalPath])
  }

  return publicUrl
}
