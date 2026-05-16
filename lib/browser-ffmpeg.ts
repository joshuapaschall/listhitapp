"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";

/**
 * Singleton ffmpeg instance + lazy loader.
 * This must only ever be used in the browser.
 */
let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<unknown> | null = null;
async function fetchFile(file: File | Blob | Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  if (file instanceof Uint8Array) return file;
  if (file instanceof ArrayBuffer) return new Uint8Array(file);
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

function ensureBrowser() {
  if (typeof window === "undefined") {
    throw new Error("browser-ffmpeg helpers must be called from the browser only");
  }
}

async function getFfmpeg() {
  ensureBrowser();

  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }

  if (!ffmpegInstance.loaded) {
    if (!loadPromise) {
      loadPromise = ffmpegInstance.load();
    }
    await loadPromise;
  }

  return ffmpegInstance;
}

export function needsVideoConversion(file: File): boolean {
  if (!file.type.startsWith("video/")) return false;
  if (file.type === "video/mp4") return false;
  return true;
}

export function needsAudioConversion(file: File): boolean {
  if (!file.type.startsWith("audio/")) return false;
  if (file.type === "audio/mpeg" || file.type === "audio/mp4") return false;
  return true;
}

export async function convertVideoToMp4(file: File): Promise<File> {
  ensureBrowser();

  if (!needsVideoConversion(file)) {
    return file;
  }

  const ffmpeg = await getFfmpeg();
  const inputName = "input";
  const outputName = "output.mp4";

  ffmpeg.deleteFile(outputName).catch(() => {});
  ffmpeg.deleteFile(inputName).catch(() => {});

  await ffmpeg.writeFile(inputName, await fetchFile(file));

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

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName) as Uint8Array;
  const blob = new Blob([data.buffer], { type: "video/mp4" });

  ffmpeg.deleteFile(outputName).catch(() => {});
  ffmpeg.deleteFile(inputName).catch(() => {});

  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".mp4", {
    type: "video/mp4",
    lastModified: Date.now(),
  });
}

export async function convertAudioToMp3(file: File): Promise<File> {
  ensureBrowser();

  if (!needsAudioConversion(file)) {
    return file;
  }

  const ffmpeg = await getFfmpeg();
  const inputName = "input";
  const outputName = "output.mp3";

  ffmpeg.deleteFile(outputName).catch(() => {});
  ffmpeg.deleteFile(inputName).catch(() => {});

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const args = ["-i", inputName, "-acodec", "libmp3lame", "-b:a", "96k", "-f", "mp3", outputName];

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName) as Uint8Array;
  const blob = new Blob([data.buffer], { type: "audio/mpeg" });

  ffmpeg.deleteFile(outputName).catch(() => {});
  ffmpeg.deleteFile(inputName).catch(() => {});

  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".mp3", {
    type: "audio/mpeg",
    lastModified: Date.now(),
  });
}

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
