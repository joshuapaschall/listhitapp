import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import fs from "fs"

let configuredPath: string | null = null

export async function ensureFfmpegAvailable(): Promise<string> {
  if (configuredPath) return configuredPath

  const envPath = process.env.FFMPEG_PATH
  const defaultPath = ffmpegPath || ""
  const fallbackPath = "/var/task/node_modules/ffmpeg-static/ffmpeg"
  const candidates = [envPath, defaultPath, fallbackPath].filter(Boolean) as string[]

  if (!candidates.length) {
    throw new Error("FFmpeg binary path is not configured")
  }

  let resolved: string | null = null

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        resolved = candidate
        break
      }
    } catch (err) {
      console.warn("Error checking FFmpeg path", candidate, err)
    }
  }

  const selected = resolved ?? candidates[0]

  if (resolved) {
    console.log("Using FFmpeg binary for audio conversion", selected)
  } else {
    console.warn("FFmpeg binary not found at any candidate paths", candidates)
  }

  ffmpeg.setFfmpegPath(selected)
  configuredPath = selected
  return selected
}
