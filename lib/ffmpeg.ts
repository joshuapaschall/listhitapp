import { spawn } from "child_process"
import path from "path"
import fs from "fs"

let resolvedFfmpegPath: string | null = null

export function getFfmpegPath(): string | null {
  if (resolvedFfmpegPath !== null) return resolvedFfmpegPath

  // 1. If the env var is explicitly set, trust that.
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    resolvedFfmpegPath = process.env.FFMPEG_PATH
    return resolvedFfmpegPath
  }

  // 2. Prefer the relative node_modules path used in Vercel example
  const localNodeModulesPath = path.join(
    process.cwd(),
    "node_modules",
    "ffmpeg-static",
    "ffmpeg",
  )

  if (fs.existsSync(localNodeModulesPath)) {
    resolvedFfmpegPath = localNodeModulesPath
    return resolvedFfmpegPath
  }

  // 3. As a last resort, try the "ffmpeg-static" default export path (if your current code uses it)
  try {
    // NOTE: keep this import dynamic so it doesn't break edge runtimes
    // @ts-ignore
    const ffmpegStatic = require("ffmpeg-static") as string | null
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      resolvedFfmpegPath = ffmpegStatic
      return resolvedFfmpegPath
    }
  } catch {
    // ignore
  }

  resolvedFfmpegPath = null
  return null
}

export function spawnFfmpeg(args: string[]) {
  const ffmpegPath = getFfmpegPath()
  if (!ffmpegPath) {
    throw new Error("FFmpeg binary not available in this environment")
  }

  return spawn(ffmpegPath, args, {
    stdio: ["pipe", "pipe", "pipe"],
  })
}
