import ffmpeg from "fluent-ffmpeg"
import { getFfmpegPath } from "@/lib/ffmpeg"

let configuredPath: string | null = null

export async function ensureFfmpegAvailable(): Promise<string | null> {
  if (configuredPath !== null) return configuredPath

  const ffmpegBinary = getFfmpegPath()

  if (!ffmpegBinary) {
    const message =
      "[ffmpeg] Binary not found; set FFMPEG_PATH or add ffmpeg-static to your deployment"

    if (process.env.NODE_ENV === "production") {
      console.error(message)
      throw new Error("FFmpeg binary not found in production runtime")
    }

    console.warn(message)
    configuredPath = null
    return null
  }

  ffmpeg.setFfmpegPath(ffmpegBinary)
  configuredPath = ffmpegBinary
  process.env.FFMPEG_PATH = ffmpegBinary
  console.log("[ffmpeg] Using FFmpeg binary", ffmpegBinary)
  return configuredPath
}
