// Client-side downscale + recompress for images so uploads never hard-fail on
// size. Follows the existing "convert before upload" pattern in
// utils/uploadMedia.ts (which already converts audio/video via browser-ffmpeg).

// Pure decision: should this file be resized at all? Non-images and GIFs (to
// keep animation) pass through; images already under target pass through.
// Extracted so it can be unit-tested without canvas/createImageBitmap.
export function shouldResize(file: File, targetBytes = 1024 * 1024): boolean {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return false
  return file.size > targetBytes
}

// Downscale an image File so its longest side ≤ maxDim and its bytes ≤ targetBytes,
// re-encoding to JPEG. Non-images / GIFs / already-small images pass through.
export async function resizeImageFile(
  file: File,
  opts: { maxDim?: number; targetBytes?: number } = {},
): Promise<File> {
  const maxDim = opts.maxDim ?? 1600
  const targetBytes = opts.targetBytes ?? 1024 * 1024
  if (!shouldResize(file, targetBytes)) return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)

  // Step quality down until under targetBytes (or floor reached).
  let quality = 0.85
  let blob = await canvasToBlob(canvas, "image/jpeg", quality)
  while (blob && blob.size > targetBytes && quality > 0.4) {
    quality -= 0.1
    blob = await canvasToBlob(canvas, "image/jpeg", quality)
  }
  if (!blob) return file
  const newName = file.name.replace(/\.(png|webp|bmp|jpeg|jpg)$/i, "") + ".jpg"
  return new File([blob], newName, { type: "image/jpeg" })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality))
}
