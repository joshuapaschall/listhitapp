// Browser-only image normalization. Every selected photo is decoded, downscaled,
// and re-encoded to JPEG at selection time so Storage only ever receives
// image/jpeg | image/png | image/webp. HEIC (iPhone) is transcoded first via
// heic2any, which is loaded lazily so its ~2.7MB WASM never enters the main
// bundle. This module must never be imported from a server component or API route.

export type NormalizeResult =
  | { ok: true; file: File; converted: boolean }
  | { ok: false; name: string; reason: string }

export const MAX_INPUT_BYTES = 40 * 1024 * 1024
export const MAX_OUTPUT_BYTES = 9 * 1024 * 1024 // server gate is 10MB — leave headroom
export const MAX_EDGE = 2560

const HEIC_BRANDS = [
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]

const DIRECT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/avif"]
const EXTENSION_RE = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i

function baseName(name: string): string {
  const stripped = name.replace(/\.[^.]+$/, "")
  return stripped || "photo"
}

/**
 * Detect HEIC/HEIF by sniffing the ISO-BMFF `ftyp` box — `File.type` is
 * unreliable (empty on Chrome/Windows, `image/heic` on Safari, `image/heif`
 * elsewhere). On a read error the magic-byte check is inconclusive, so we fall
 * back to the filename extension.
 */
export async function isHeic(file: File): Promise<boolean> {
  try {
    const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer())
    if (bytes.length < 12) return false
    const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
    if (ascii(4, 8) !== "ftyp") return false
    return HEIC_BRANDS.includes(ascii(8, 12).toLowerCase())
  } catch {
    return /\.(heic|heif)$/i.test(file.name)
  }
}

type Decoded = {
  source: CanvasImageSource
  width: number
  height: number
  cleanup: () => void
}

async function decodeImage(file: File): Promise<Decoded | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file)
      return { source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close() }
    } catch {
      // fall through to the HTMLImageElement path
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("image decode failed"))
      el.src = url
    })
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, cleanup: () => {} }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

function encodeJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return Promise.resolve(null)
  // JPEG has no alpha channel and a fresh canvas is transparent black, so any
  // transparent source pixel would encode as black. Flatten onto white first —
  // this is baked pixel data in an end user's photo, so it is a literal white,
  // deliberately NOT a theme token.
  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(source, 0, 0, width, height)
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality))
}

export async function normalizeImageFile(file: File): Promise<NormalizeResult> {
  if (file.size > MAX_INPUT_BYTES) {
    return { ok: false, name: file.name, reason: "file is larger than 40MB" }
  }

  const heic = await isHeic(file)
  const typeAccepted =
    heic || DIRECT_TYPES.includes(file.type) || (file.type === "" && EXTENSION_RE.test(file.name))
  if (!typeAccepted) {
    return { ok: false, name: file.name, reason: "unsupported file type" }
  }

  let workingFile = file
  let converted = false

  if (heic) {
    try {
      const heic2any = (await import("heic2any")).default
      const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 })
      const blob = Array.isArray(out) ? out[0] : out
      workingFile = new File([blob], `${baseName(file.name)}.jpg`, { type: "image/jpeg" })
      converted = true
    } catch {
      return { ok: false, name: file.name, reason: "could not convert this HEIC photo" }
    }
  }

  const decoded = await decodeImage(workingFile)
  if (!decoded) {
    return { ok: false, name: file.name, reason: "could not read this image" }
  }

  try {
    const { source, width: w, height: h } = decoded

    // Already a bounded JPEG — skip the canvas round-trip to avoid a needless
    // generational quality loss.
    if (!converted && file.type === "image/jpeg" && file.size <= MAX_OUTPUT_BYTES && Math.max(w, h) <= MAX_EDGE) {
      return { ok: true, file, converted: false }
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(w, h)) // never upscale
    let cw = Math.max(1, Math.round(w * scale))
    let ch = Math.max(1, Math.round(h * scale))

    let blob = await encodeJpeg(source, cw, ch, 0.82)
    if (!blob) {
      return { ok: false, name: file.name, reason: "could not read this image" }
    }
    if (blob.size > MAX_OUTPUT_BYTES) {
      const retry = await encodeJpeg(source, cw, ch, 0.7)
      if (retry) blob = retry
    }
    if (blob.size > MAX_OUTPUT_BYTES) {
      cw = Math.max(1, Math.round(cw / 2))
      ch = Math.max(1, Math.round(ch / 2))
      const retry = await encodeJpeg(source, cw, ch, 0.7)
      if (retry) blob = retry
    }
    if (blob.size > MAX_OUTPUT_BYTES) {
      return { ok: false, name: file.name, reason: "photo is too large even after compression" }
    }

    return { ok: true, file: new File([blob], `${baseName(file.name)}.jpg`, { type: "image/jpeg" }), converted }
  } finally {
    decoded.cleanup()
  }
}

// heic2any multiplexes onto ONE internal worker, so parallelism buys little — a
// small pool only overlaps main-thread canvas work with the worker's next decode.
// Keep it low; a big pool won't speed anything up and risks mobile-Safari memory.
export const NORMALIZE_CONCURRENCY = 3

/**
 * Normalize with results streamed back as each file settles, so the UI can render
 * a tile per photo immediately instead of waiting for the whole batch. Runs at
 * most `concurrency` files at once via a shared cursor + worker loops. `onResult`
 * fires with each file's ORIGINAL index (callback order is not guaranteed). One
 * bad file never aborts the batch. Resolves once every file has settled.
 */
export async function normalizeImageFilesStreaming(
  files: File[],
  onResult: (index: number, result: NormalizeResult) => void,
  concurrency: number = NORMALIZE_CONCURRENCY,
): Promise<void> {
  let next = 0
  const workerCount = Math.max(1, Math.min(concurrency, files.length))

  async function worker(): Promise<void> {
    for (;;) {
      const index = next++
      if (index >= files.length) return
      let result: NormalizeResult
      try {
        result = await normalizeImageFile(files[index])
      } catch {
        result = { ok: false, name: files[index].name, reason: "could not process this photo" }
      }
      onResult(index, result)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
}

/**
 * Batch form of the streaming normalizer. Preserves INPUT order in the returned
 * arrays even though callbacks arrive out of order — the first photo becomes the
 * cover, so that ordering is load-bearing.
 */
export async function normalizeImageFiles(files: File[]): Promise<{ files: File[]; errors: string[] }> {
  const results = new Array<NormalizeResult | undefined>(files.length)
  await normalizeImageFilesStreaming(files, (i, r) => {
    results[i] = r
  })
  const out: File[] = []
  const errors: string[] = []
  for (const r of results) {
    if (!r) continue
    if (r.ok) out.push(r.file)
    else errors.push(`${r.name}: ${r.reason}`)
  }
  return { files: out, errors }
}
