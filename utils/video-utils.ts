import { supabaseAdmin } from "@/lib/supabase"
import { getTelnyxApiKey } from "@/lib/voice-env"
import { randomUUID } from "crypto"
import { PassThrough, Readable } from "stream"
import { assertServer } from "@/utils/assert-server"
import ffmpeg from "fluent-ffmpeg"
import { ensureFfmpegAvailable } from "@/utils/ffmpeg-path"

import {
  MEDIA_BUCKET,
  MAX_MMS_SIZE,
  getMediaBaseUrl,
  isPublicMediaUrl,
} from "./uploadMedia"

type VideoSource = {
  buffer: Buffer
  contentType: string
  ext: string
}

function normalizeExt(ext?: string): string {
  if (!ext) return ""
  return ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`
}

function resolveExt(inputUrl: string, contentType?: string, providedExt?: string): string {
  const fromParam = normalizeExt(providedExt)
  if (fromParam) return fromParam

  const fromUrl = normalizeExt(inputUrl.split("?")[0].match(/\.[^./]+$/)?.[0])
  if (fromUrl) return fromUrl

  if (contentType && contentType.includes("/")) {
    const subtype = contentType.split("/")[1]?.split(";")[0]
    if (subtype) return normalizeExt(subtype)
  }

  return ""
}

function resolveContentType(contentType?: string, ext?: string): string {
  if (contentType) return contentType.toLowerCase()
  const normalizedExt = normalizeExt(ext)
  if (normalizedExt === ".mov") return "video/quicktime"
  if (normalizedExt === ".mp4") return "video/mp4"
  if (normalizedExt === ".webm") return "video/webm"
  return "application/octet-stream"
}

async function uploadVideoBuffer(
  buffer: Buffer,
  contentType: string,
  ext: string,
  direction: "incoming" | "outgoing",
  inputUrl: string,
): Promise<string> {
  const safeExt = normalizeExt(ext) || ".bin"
  const id = randomUUID()
  const fileName = `${direction}/${id}${safeExt}`

  const { data, error } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(fileName, buffer, {
      contentType: resolveContentType(contentType, safeExt),
      upsert: true,
    })

  if (error || !data) {
    console.error("convertToMp4 error: Supabase upload failed", {
      inputUrl,
      error,
    })
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

async function downloadVideoSource(
  inputUrl: string,
  buffer?: Buffer,
  contentType?: string,
  ext?: string,
): Promise<VideoSource> {
  const headers: Record<string, string> = {}
  const isTelnyx = /^https:\/\/[^/]*telnyx\.com\//i.test(inputUrl)

  if (buffer) {
    const resolvedExt = resolveExt(inputUrl, contentType, ext)
    return {
      buffer,
      contentType: resolveContentType(contentType, resolvedExt),
      ext: resolvedExt,
    }
  }

  const apiKey = getTelnyxApiKey()
  if (isTelnyx && apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`
  }

  const res = await fetch(inputUrl, Object.keys(headers).length ? { headers } : {})

  if (!res.ok) {
    console.error("convertToMp4 error: failed to fetch", {
      inputUrl,
      status: res.status,
    })
    throw new Error(`Failed to fetch ${inputUrl}: ${res.status}`)
  }

  if (!res.body) {
    console.error("convertToMp4 error: no response body", { inputUrl })
    throw new Error(`No response body received from ${inputUrl}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const resolvedExt = resolveExt(
    inputUrl,
    res.headers.get("content-type")?.toLowerCase(),
    ext,
  )
  const resolvedContentType =
    res.headers.get("content-type")?.toLowerCase() ||
    resolveContentType(contentType, resolvedExt)

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: resolvedContentType,
    ext: resolvedExt,
  }
}

async function uploadOriginalBufferAsVideo(
  buffer: Buffer,
  direction: "incoming" | "outgoing",
  inputUrl: string,
  contentType?: string,
  ext?: string,
): Promise<string> {
  const resolvedExt = resolveExt(inputUrl, contentType, ext)
  const resolvedContentType = resolveContentType(contentType, resolvedExt)
  return uploadVideoBuffer(buffer, resolvedContentType, resolvedExt, direction, inputUrl)
}

export async function convertToMp4(
  inputUrl: string,
  direction: "incoming" | "outgoing" = "incoming",
  buffer?: Buffer,
  contentType?: string,
  ext?: string,
): Promise<string> {
  assertServer()
  const ffmpegBinary = await ensureFfmpegAvailable()
  const source = await downloadVideoSource(inputUrl, buffer, contentType, ext)

  if (!ffmpegBinary) {
    console.warn(
      "convertToMp4: FFmpeg not available in this environment, skipping conversion and uploading original file",
      { inputUrl },
    )

    return uploadOriginalBufferAsVideo(
      source.buffer,
      direction,
      inputUrl,
      source.contentType,
      source.ext,
    )
  }

  console.log("Using FFmpeg binary for video conversion", ffmpegBinary)

  const inputStream = Readable.from(source.buffer)

  const mp4 = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    const command = ffmpeg(inputStream)
      .videoCodec("libx264")
      .audioCodec("aac")
      .format("mp4")
      .outputOptions([
        "-movflags",
        "faststart",
        "-pix_fmt",
        "yuv420p",
      ])

    command.on("error", reject)

    const output = command.pipe(new PassThrough())
    output.on("data", (d: Buffer) => chunks.push(d))
    output.on("error", reject)
    output.on("end", () => resolve(Buffer.concat(chunks)))
  })

  if (mp4.length > MAX_MMS_SIZE) {
    console.error("convertToMp4 error: converted video too large", { inputUrl })
    throw new Error("Converted video exceeds the 1MB MMS limit")
  }

  return uploadVideoBuffer(mp4, "video/mp4", ".mp4", direction, inputUrl)
}
