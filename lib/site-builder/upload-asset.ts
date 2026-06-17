"use client"
import { supabaseBrowser } from "@/lib/supabase-browser"

export const ASSET_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml"

// Sign + upload a brand asset (logo / hero photo) to the public site-assets
// bucket via the browser client, returning its public URL. Mirrors the
// property-image upload flow — never touches the admin client.
// Downscale an oversized raster image in the browser before upload, so a tenant
// never ships a logo or photo far larger than it's ever displayed. SVGs (vector)
// and images already within the target width pass through untouched. When we do
// resize, output is WebP (smaller, preserves transparency). Any failure falls
// back to the original file so uploads never break.
export async function downscaleImage(file: File, maxWidth: number): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  if (bitmap.width <= maxWidth) {
    bitmap.close()
    return file
  }
  const w = maxWidth
  const h = Math.round((bitmap.height * maxWidth) / bitmap.width)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    bitmap.close()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", 0.9),
  )
  if (!blob) return file
  const newName = file.name.replace(/\.[^.]+$/, "") + ".webp"
  return new File([blob], newName, { type: "image/webp" })
}

export async function uploadSiteAsset(file: File, siteId: string): Promise<string> {
  const signRes = await fetch(`/api/sites/${siteId}/assets/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: [{ name: file.name, type: file.type, size: file.size }] }),
  })
  const signData = await signRes.json().catch(() => ({}))
  const entry = signData?.signed?.[0]
  if (!signRes.ok || !entry) {
    throw new Error(signData?.errors?.[0] || signData?.error || "Could not start upload")
  }
  const supabase = supabaseBrowser()
  const { error: upErr } = await supabase.storage
    .from("site-assets")
    .uploadToSignedUrl(entry.path, entry.token, file, { contentType: file.type, cacheControl: "31536000" })
  if (upErr) throw new Error(upErr.message)
  return supabase.storage.from("site-assets").getPublicUrl(entry.path).data.publicUrl
}
