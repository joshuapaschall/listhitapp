import { spawn, spawnSync } from "child_process"
import path from "path"
import fs from "fs"

let resolvedFfmpegPath: string | null = null

function probeCandidate(candidate: string | null, verifyExists = true): string | null {
  if (!candidate) return null

  if (verifyExists && !fs.existsSync(candidate)) {
    return null
  }

  try {
    const probe = spawnSync(candidate, ["-version"], { stdio: "ignore" })
    if (probe.status === 0) {
      return candidate
    }
  } catch (err) {
    console.warn(`[ffmpeg] Unable to execute candidate binary: ${candidate}`, err)
  }

  return null
}

export function getFfmpegPath(): string | null {
  if (resolvedFfmpegPath !== null) return resolvedFfmpegPath

  const binaryName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
  const candidates: Array<{ path: string | null; verifyExists?: boolean }> = [
    { path: process.env.FFMPEG_PATH || null },
  ]

  try {
    // NOTE: keep this import dynamic so it doesn't break edge runtimes
    // @ts-ignore
    const ffmpegStatic = require("ffmpeg-static") as string | null
    candidates.push({ path: ffmpegStatic })
  } catch {
    // ignore
  }

  candidates.push({
    path: path.join(process.cwd(), "node_modules", "ffmpeg-static", binaryName),
  })

  // As a last resort, try the global binary on PATH
  candidates.push({ path: binaryName, verifyExists: false })

  for (const candidate of candidates) {
    const resolved = probeCandidate(candidate.path, candidate.verifyExists ?? true)
    if (resolved) {
      resolvedFfmpegPath = resolved
      process.env.FFMPEG_PATH = resolved
      return resolvedFfmpegPath
    }
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
