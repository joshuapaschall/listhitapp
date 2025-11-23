import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import fs from "fs"

let configuredPath: string | null = null

export async function ensureFfmpegAvailable(): Promise<string> {
  if (configuredPath) return configuredPath

  const candidate = process.env.FFMPEG_PATH || ffmpegPath
  if (!candidate) {
    throw new Error("FFmpeg binary path is not configured")
  }

  const resolved = candidate

  try {
    if (!fs.existsSync(resolved)) {
      console.warn("FFmpeg binary not found at", resolved, "continuing anyway")
    }
  } catch (err) {
    console.warn("Error checking FFmpeg path", resolved, err)
  }

  ffmpeg.setFfmpegPath(resolved)
  configuredPath = resolved
  return resolved
}
