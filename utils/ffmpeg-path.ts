import ffmpeg from "fluent-ffmpeg"
import ffmpegStatic from "ffmpeg-static"
import fs from "fs"
import path from "path"

let configuredPath: string | null = null

export function ensureFfmpegAvailable(): string {
  if (configuredPath) return configuredPath

  const candidate = process.env.FFMPEG_PATH || ffmpegStatic
  if (!candidate) {
    throw new Error("FFmpeg binary path is not configured")
  }

  const resolved = path.isAbsolute(candidate)
    ? candidate
    : path.join(process.cwd(), candidate)

  try {
    const exists = fs.existsSync(resolved)
    console.log("FFmpeg preflight", { path: resolved, exists })
  } catch {
    console.log("FFmpeg preflight", { path: resolved, exists: false })
  }

  ffmpeg.setFfmpegPath(resolved)
  configuredPath = resolved
  return resolved
}
