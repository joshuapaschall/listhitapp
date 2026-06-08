// lib/site-builder/image-url.ts
//
// Rewrites Supabase Storage public object URLs to the on-the-fly image
// transformation CDN (/render/image/public/…), which serves right-sized,
// content-negotiated WebP/AVIF from Supabase's edge. No Vercel image optimizer
// is involved — next.config keeps images.unoptimized: true.
//
// Non-Supabase URLs (Unsplash hero defaults, any external) pass through
// untouched. Kill switch: NEXT_PUBLIC_SITE_IMAGE_TRANSFORM="0" reverts every
// image to its raw public URL (use if the Supabase plan lacks Image
// Transformations). Client-safe: NEXT_PUBLIC_* is inlined at build time.

const OBJECT_PUBLIC = "/storage/v1/object/public/"
const RENDER_PUBLIC = "/storage/v1/render/image/public/"

function transformsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SITE_IMAGE_TRANSFORM !== "0"
}

/**
 * Returns a width-constrained, quality-tuned Supabase render URL for a stored
 * public object URL. Non-Supabase or empty inputs are returned unchanged
 * (undefined for empty), so it is always safe to use as an <img src>.
 */
export function siteImage(
  url: string | null | undefined,
  opts: { width: number; quality?: number } = { width: 1200 },
): string | undefined {
  if (!url) return undefined
  if (!transformsEnabled()) return url
  const i = url.indexOf(OBJECT_PUBLIC)
  if (i === -1) return url // not a Supabase public object URL — leave as-is
  const rendered =
    url.slice(0, i) + RENDER_PUBLIC + url.slice(i + OBJECT_PUBLIC.length)
  const sep = rendered.includes("?") ? "&" : "?"
  const quality = opts.quality ?? 75
  return `${rendered}${sep}width=${Math.round(opts.width)}&quality=${quality}`
}

/**
 * Builds a srcset of transformed candidates for responsive selection. Returns
 * undefined for non-Supabase URLs (so the bare src still works) or when
 * transforms are disabled.
 */
export function siteSrcSet(
  url: string | null | undefined,
  widths: number[],
  quality = 75,
): string | undefined {
  if (!url) return undefined
  if (!transformsEnabled()) return undefined
  if (url.indexOf(OBJECT_PUBLIC) === -1) return undefined // Supabase URLs only
  return widths
    .map((w) => `${siteImage(url, { width: w, quality })} ${w}w`)
    .join(", ")
}
