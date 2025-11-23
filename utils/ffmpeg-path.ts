import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import fs from "fs"

let configuredPath: string | null = null

export function ensureFfmpegAvailable(): string {
  if (configuredPath) return configuredPath

  const candidate = process.env.FFMPEG_PATH || ffmpegPath

  if (!candidate) {
    const message = "FFmpeg binary path is not configured"
    console.error(message, { ffmpegPath })
    throw new Error(message)
  }

  const resolved = candidate

  const exists = fs.existsSync(resolved)
  console.log("FFmpeg preflight", { path: resolved, exists })

  if (!exists) {
    console.warn("FFmpeg binary not found at", resolved, "continuing anyway")
  }

  ffmpeg.setFfmpegPath(resolved)
  configuredPath = resolved
  return resolved
}
