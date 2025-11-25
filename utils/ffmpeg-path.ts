import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "ffmpeg-static"
import fs from "fs"

let configuredPath: string | null = null

export async function ensureFfmpegAvailable(): Promise<string | null> {
  if (configuredPath !== null) return configuredPath

  const envPath = process.env.FFMPEG_PATH
  const defaultPath = typeof ffmpegPath === "string" ? ffmpegPath : ""
  const extraCandidates = [
    "/var/task/.next/server/chunks/ffmpeg",
    "/var/task/node_modules/ffmpeg-static/ffmpeg",
  ]

  const candidates = [envPath, defaultPath, ...extraCandidates].filter(Boolean) as string[]

  if (!candidates.length) {
    console.warn("[ffmpeg] No candidates configured; FFmpeg will be disabled")
    configuredPath = null
    return null
  }

  let resolved: string | null = null

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        resolved = candidate
        break
      }
    } catch (err) {
      console.warn("[ffmpeg] Error checking path", candidate, err)
    }
  }

  if (!resolved) {
    console.warn(
      "[ffmpeg] Binary not found at any candidate paths; FFmpeg will be disabled",
      candidates,
    )
    configuredPath = null
    return null
  }

  ffmpeg.setFfmpegPath(resolved)
  configuredPath = resolved
  console.log("[ffmpeg] Using FFmpeg binary", resolved)
  return resolved
}
