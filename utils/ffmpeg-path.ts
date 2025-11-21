import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import fs from "fs"
import path from "path"

let configuredPath: string | null = null

export function ensureFfmpegAvailable(): string {
  if (configuredPath) return configuredPath

  const candidate = process.env.FFMPEG_PATH || ffmpegPath

  if (!candidate) {
    const message = "FFmpeg binary path is not configured"
    console.error(message, { ffmpegPath })
    throw new Error(message)
  }

  const resolved = path.isAbsolute(candidate)
    ? candidate
    : path.join(process.cwd(), candidate)

  const exists = fs.existsSync(resolved)
  console.log("FFmpeg preflight", { path: resolved, exists })

  if (!exists) {
    const message = `FFmpeg binary not found at ${resolved}`
    console.error(message)
    throw new Error(message)
  }

  ffmpeg.setFfmpegPath(resolved)
  configuredPath = resolved
  return resolved
}
