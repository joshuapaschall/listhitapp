import ffmpeg from "fluent-ffmpeg"
import { getFfmpegPath } from "@/lib/ffmpeg"

let configuredPath: string | null = null

export async function ensureFfmpegAvailable(): Promise<string | null> {
  if (configuredPath !== null) return configuredPath

  const ffmpegBinary = getFfmpegPath()

  if (!ffmpegBinary) {
    console.warn("[ffmpeg] Binary not found; FFmpeg will be disabled")
    configuredPath = null
    return null
  }

  ffmpeg.setFfmpegPath(ffmpegBinary)
  configuredPath = ffmpegBinary
  console.log("[ffmpeg] Using FFmpeg binary", ffmpegBinary)
  return configuredPath
}
