import { supabaseAdmin } from "@/lib/supabase"
import { getTelnyxApiKey } from "@/lib/voice-env"
import { randomUUID } from "crypto"
import { PassThrough, Readable } from "stream"
import { assertServer } from "@/utils/assert-server"
import ffmpeg from "fluent-ffmpeg"
import { ensureFfmpegAvailable } from "@/utils/ffmpeg-path"

import {
  MEDIA_BUCKET,
  getMediaBaseUrl,
  isPublicMediaUrl,
  MAX_MMS_SIZE,
} from "./uploadMedia"

export async function convertToMp3(
  inputUrl: string,
  direction: "incoming" | "outgoing" = "incoming",
  buffer?: Buffer,
): Promise<string> {
  assertServer()
  const ffmpegBinary = ensureFfmpegAvailable()
  console.log("Using FFmpeg binary for audio conversion", ffmpegBinary)

  const headers: Record<string, string> = {}
  const isTelnyx = /^https:\/\/[^/]*telnyx\.com\//i.test(inputUrl)
  let inputStream: NodeJS.ReadableStream
  if (buffer) {
    const stream = new PassThrough()
    stream.end(buffer)
    inputStream = stream
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

    if (!res.body) {
      throw new Error(`No response body received from ${inputUrl}`)
    }

    inputStream = Readable.fromWeb(res.body as unknown as ReadableStream)
  }

  const mp3 = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    const command = ffmpeg(inputStream).format("mp3")

    command.on("error", reject)

    const output = command.pipe(new PassThrough())
    output.on("data", (d: Buffer) => chunks.push(d))
    output.on("error", reject)
    output.on("end", () => resolve(Buffer.concat(chunks)))
  })

  if (mp3.length > MAX_MMS_SIZE) {
    throw new Error("Converted audio exceeds the 1MB MMS limit")
  }

  const id = randomUUID()
  const fileName = `${direction}/${id}.mp3`

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
