"use client";

import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

/**
 * Singleton ffmpeg instance + lazy loader.
 * This must only ever be used in the browser.
 */
let ffmpegInstance: ReturnType<typeof createFFmpeg> | null = null;
let loadPromise: Promise<void> | null = null;

function ensureBrowser() {
  if (typeof window === "undefined") {
    throw new Error("browser-ffmpeg helpers must be called from the browser only");
  }
}

async function getFfmpeg() {
  ensureBrowser();

  if (!ffmpegInstance) {
    ffmpegInstance = createFFmpeg({
      log: false,
      // If we ever want a custom core path, we can set corePath here.
    });
  }

  if (!ffmpegInstance.isLoaded()) {
    if (!loadPromise) {
      loadPromise = ffmpegInstance.load();
    }
    await loadPromise;
  }

  return ffmpegInstance;
}

/**
 * Returns true if this file is a video type that is *not* already an mp4
 * and should be normalized before upload.
 */
export function needsVideoConversion(file: File): boolean {
  if (!file.type.startsWith("video/")) return false;
  if (file.type === "video/mp4") return false;
  return true;
}

/**
 * Returns true if this file is an audio type that is *not* already an mp3/m4a
 * and should be normalized before upload.
 */
export function needsAudioConversion(file: File): boolean {
  if (!file.type.startsWith("audio/")) return false;
  if (file.type === "audio/mpeg" || file.type === "audio/mp4") return false;
  return true;
}

/**
 * Convert an arbitrary video file to H.264 MP4 suitable for MMS / web playback.
 * - Reasonable size and compatibility for Telnyx + browsers.
 */
export async function convertVideoToMp4(file: File): Promise<File> {
  ensureBrowser();

  if (!needsVideoConversion(file)) {
    return file;
  }

  const ffmpeg = await getFfmpeg();
  const inputName = "input";
  const outputName = "output.mp4";

  // Clear the FS for safety
  ffmpeg.FS("unlink", outputName).catch(() => {});
  ffmpeg.FS("unlink", inputName).catch(() => {});

  ffmpeg.FS("writeFile", inputName, await fetchFile(file));

  // Very simple but safe MP4 recipe for small MMS-sized clips.
  const args = [
    "-i",
    inputName,
    "-vf",
    "scale='min(640,iw)':'-2'",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "28",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
    outputName,
  ];

  await ffmpeg.run(...args);

  const data = ffmpeg.FS("readFile", outputName);
  const blob = new Blob([data.buffer], { type: "video/mp4" });

  // Clean up
  ffmpeg.FS("unlink", outputName).catch(() => {});
  ffmpeg.FS("unlink", inputName).catch(() => {});

  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".mp4", {
    type: "video/mp4",
    lastModified: Date.now(),
  });
}

/**
 * Convert an arbitrary audio file to MP3 for playback and delivery.
 * This is mainly to normalize audio/webm and carrier audio formats.
 */
export async function convertAudioToMp3(file: File): Promise<File> {
  ensureBrowser();

  if (!needsAudioConversion(file)) {
    return file;
  }

  const ffmpeg = await getFfmpeg();
  const inputName = "input";
  const outputName = "output.mp3";

  ffmpeg.FS("unlink", outputName).catch(() => {});
  ffmpeg.FS("unlink", inputName).catch(() => {});

  ffmpeg.FS("writeFile", inputName, await fetchFile(file));

  const args = [
    "-i",
    inputName,
    "-acodec",
    "libmp3lame",
    "-b:a",
    "96k",
    "-f",
    "mp3",
    outputName,
  ];

  await ffmpeg.run(...args);

  const data = ffmpeg.FS("readFile", outputName);
  const blob = new Blob([data.buffer], { type: "audio/mpeg" });

  ffmpeg.FS("unlink", outputName).catch(() => {});
  ffmpeg.FS("unlink", inputName).catch(() => {});

  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".mp3", {
    type: "audio/mpeg",
    lastModified: Date.now(),
  });
}

/**
 * Helpers for future: convert raw blobs (e.g. incoming .3gp/.amr from Supabase)
 * into playable blobs in the browser. These are not yet wired up, but we expose
 * them now for later use when we build incoming-media playback.
 */
export async function convertIncomingVideoBlobToMp4(
  blob: Blob,
  name: string = "incoming",
): Promise<Blob> {
  const file = new File([blob], name, { type: blob.type || "video/3gpp" });
  const converted = await convertVideoToMp4(file);
  return converted;
}

export async function convertIncomingAudioBlobToMp3(
  blob: Blob,
  name: string = "incoming",
): Promise<Blob> {
  const file = new File([blob], name, { type: blob.type || "audio/amr" });
  const converted = await convertAudioToMp3(file);
  return converted;
}
