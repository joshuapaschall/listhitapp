import { createFFmpeg, fetchFile, type FFmpeg } from "@ffmpeg/ffmpeg"

const VIDEO_TARGET_MIME = "video/mp4"
const AUDIO_TARGET_MIME = "audio/mpeg"

let ffmpegInstance: FFmpeg | null = null

function ensureBrowser() {
  if (typeof window === "undefined") {
    throw new Error("Browser FFmpeg is only available in the browser runtime")
  }
}

async function getFfmpeg(): Promise<FFmpeg> {
  if (!ffmpegInstance) {
    ffmpegInstance = createFFmpeg({ log: false })
  }

  if (!ffmpegInstance.isLoaded()) {
    await ffmpegInstance.load()
  }

  return ffmpegInstance
}

function getExtension(name: string): string {
  const match = name.match(/\.([^.]+)$/)
  return match ? `.${match[1]}` : ""
}

export function needsVideoConversion(file: File): boolean {
  return file.type.startsWith("video/") && file.type !== VIDEO_TARGET_MIME
}

export function needsAudioConversion(file: File): boolean {
  return file.type.startsWith("audio/") && file.type !== AUDIO_TARGET_MIME
}

export async function convertVideoToMp4(file: File): Promise<File> {
  ensureBrowser()
  if (!needsVideoConversion(file)) return file

  console.info(
    "[browser-ffmpeg] Converting video to mp4",
    file.name,
    file.type,
    file.size,
  )

  const ffmpeg = await getFfmpeg()
  const inputName = `input_${crypto.randomUUID()}${getExtension(file.name)}`
  const outputName = `output_${crypto.randomUUID()}.mp4`

  try {
    // Clear the FS for safety
    try {
      ffmpeg.FS("unlink", outputName)
    } catch (_) {}
    try {
      ffmpeg.FS("unlink", inputName)
    } catch (_) {}

    ffmpeg.FS("writeFile", inputName, await fetchFile(file))
    await ffmpeg.run(
      "-i",
      inputName,
      "-movflags",
      "faststart",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-strict",
      "experimental",
      outputName,
    )
    const data = ffmpeg.FS("readFile", outputName)
    const blob = new Blob([data.buffer], { type: VIDEO_TARGET_MIME })

    console.info(
      "[browser-ffmpeg] Video converted to mp4",
      file.name,
      "=>",
      outputName,
      blob.size,
    )

    return new File(
      [blob],
      file.name.replace(/\.[^.]+$/, "") + ".mp4",
      {
        type: VIDEO_TARGET_MIME,
      },
    )
  } finally {
    // Clean up
    try {
      ffmpeg.FS("unlink", outputName)
    } catch (_) {}
    try {
      ffmpeg.FS("unlink", inputName)
    } catch (_) {}
  }
}

export async function convertAudioToMp3(file: File): Promise<File> {
  ensureBrowser()
  if (!needsAudioConversion(file)) return file

  console.info(
    "[browser-ffmpeg] Converting audio to mp3",
    file.name,
    file.type,
    file.size,
  )

  const ffmpeg = await getFfmpeg()
  const inputName = `input_${crypto.randomUUID()}${getExtension(file.name)}`
  const outputName = `output_${crypto.randomUUID()}.mp3`

  try {
    try {
      ffmpeg.FS("unlink", outputName)
    } catch (_) {}
    try {
      ffmpeg.FS("unlink", inputName)
    } catch (_) {}

    ffmpeg.FS("writeFile", inputName, await fetchFile(file))
    await ffmpeg.run("-i", inputName, "-codec:a", "libmp3lame", outputName)
    const data = ffmpeg.FS("readFile", outputName)
    const blob = new Blob([data.buffer], { type: AUDIO_TARGET_MIME })

    console.info(
      "[browser-ffmpeg] Audio converted to mp3",
      file.name,
      "=>",
      outputName,
      blob.size,
    )

    return new File(
      [blob],
      file.name.replace(/\.[^.]+$/, "") + ".mp3",
      {
        type: AUDIO_TARGET_MIME,
      },
    )
  } finally {
    try {
      ffmpeg.FS("unlink", outputName)
    } catch (_) {}
    try {
      ffmpeg.FS("unlink", inputName)
    } catch (_) {}
  }
}
