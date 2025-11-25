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

type AudioSource = {
  buffer: Buffer
  contentType: string
  ext: string
}

const AUDIO_MIME_MAP: Record<string, string> = {
  ".aac": "audio/aac",
  ".amr": "audio/amr",
  ".flac": "audio/flac",
  ".m4a": "audio/x-m4a",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/opus",
  ".wav": "audio/wav",
  ".weba": "audio/webm",
  ".webm": "audio/webm",
  ".3gp": "audio/3gpp",
  ".3gpp": "audio/3gpp",
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
  const normalizedExt = normalizeExt(ext)
  if (contentType) return contentType.toLowerCase()
  if (normalizedExt && AUDIO_MIME_MAP[normalizedExt]) {
    return AUDIO_MIME_MAP[normalizedExt]
  }
  return "application/octet-stream"
}

async function uploadAudioBuffer(
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
    console.error("convertToMp3 error: Supabase upload failed", {
      inputUrl,
      error,
    })
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

async function downloadAudioSource(
  inputUrl: string,
  buffer?: Buffer,
  contentType?: string,
  ext?: string,
): Promise<AudioSource> {
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
    console.error("convertToMp3 error: failed to fetch", {
      inputUrl,
      status: res.status,
    })
    throw new Error(`Failed to fetch ${inputUrl}: ${res.status}`)
  }

  if (!res.body) {
    console.error("convertToMp3 error: no response body", { inputUrl })
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

async function uploadOriginalBufferAsAudio(
  buffer: Buffer,
  direction: "incoming" | "outgoing",
  inputUrl: string,
  contentType?: string,
  ext?: string,
): Promise<string> {
  const resolvedExt = resolveExt(inputUrl, contentType, ext)
  const resolvedContentType = resolveContentType(contentType, resolvedExt)
  return uploadAudioBuffer(buffer, resolvedContentType, resolvedExt, direction, inputUrl)
}

export async function convertToMp3(
  inputUrl: string,
  direction: "incoming" | "outgoing" = "incoming",
  buffer?: Buffer,
  contentType?: string,
  ext?: string,
): Promise<string> {
  assertServer()
  const ffmpegBinary = await ensureFfmpegAvailable()
  const source = await downloadAudioSource(inputUrl, buffer, contentType, ext)

  if (!ffmpegBinary) {
    console.warn(
      "convertToMp3: FFmpeg not available in this environment, skipping conversion and uploading original file",
      { inputUrl },
    )

    return uploadOriginalBufferAsAudio(
      source.buffer,
      direction,
      inputUrl,
      source.contentType,
      source.ext,
    )
  }

  console.log("Using FFmpeg binary for audio conversion", ffmpegBinary)

  const inputStream = Readable.from(source.buffer)

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
    console.error("convertToMp3 error: converted audio too large", { inputUrl })
    throw new Error("Converted audio exceeds the 1MB MMS limit")
  }

  return uploadAudioBuffer(mp3, "audio/mpeg", ".mp3", direction, inputUrl)
}
