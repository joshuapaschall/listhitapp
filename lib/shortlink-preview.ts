// Pure, client-safe helpers for accurate short-link-aware SMS previews.
// No DB or server imports — domain and slugLength are passed in so this runs in
// the browser and is unit-testable. Mirrors the send route's URL detection.

export const SMS_URL_REGEX = /(https?:\/\/[^\s"'>]+)/g

const SAMPLE_SLUG_SEED = "Ab3Xy9z"

/** Length of a short URL: "https://" (8) + domain + "/" (1) + slug. */
export function shortLinkLength(domain: string, slugLength = 7): number {
  return 8 + domain.length + 1 + slugLength
}

/** A length-accurate sample short URL. Real per-recipient slugs are all slugLength chars. */
export function sampleShortUrl(domain: string, slugLength = 7): string {
  const slug = SAMPLE_SLUG_SEED.slice(0, slugLength).padEnd(slugLength, "x")
  return `https://${domain}/${slug}`
}

/** The sample slug alone (for highlighting the code portion in the UI). */
export function sampleSlug(slugLength = 7): string {
  return SAMPLE_SLUG_SEED.slice(0, slugLength).padEnd(slugLength, "x")
}

export interface ShortLinkPreview {
  effective: string
  urlCount: number
  charsSaved: number
}

/** Replace every distinct URL in `message` with a length-accurate sample short URL. */
export function applyShortLinkPreview(
  message: string,
  domain: string,
  slugLength = 7,
): ShortLinkPreview {
  const urls = Array.from(new Set(message.match(SMS_URL_REGEX) || []))
  if (urls.length === 0 || !domain) {
    return { effective: message, urlCount: 0, charsSaved: 0 }
  }
  const su = sampleShortUrl(domain, slugLength)
  let effective = message
  for (const u of urls) effective = effective.split(u).join(su)
  return { effective, urlCount: urls.length, charsSaved: message.length - effective.length }
}

export interface ShortLinkConfig {
  domain: string
  slugLength: number
  configured: boolean
}

const DEFAULT_CONFIG: ShortLinkConfig = { domain: "", slugLength: 7, configured: false }

/** Client fetch for the org's short-link config (domain + slug length). */
export async function fetchShortLinkConfig(): Promise<ShortLinkConfig> {
  try {
    const res = await fetch("/api/short-links/config", { cache: "no-store" })
    if (!res.ok) return DEFAULT_CONFIG
    const json = await res.json()
    return {
      domain: typeof json.domain === "string" ? json.domain : "",
      slugLength: Number.isFinite(json.slugLength) ? json.slugLength : 7,
      configured: Boolean(json.configured),
    }
  } catch {
    return DEFAULT_CONFIG
  }
}
