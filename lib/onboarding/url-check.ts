import "server-only"

// Does a public page actually load? Used for the "I already have a website"
// check and the admin approval view. Treats any 2xx (after redirects) as loaded.
// Never throws.

export type UrlCheck = { url: string; ok: boolean; status: number | null }

export function normalizeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  let v = raw.trim()
  if (!v) return null
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`
  try {
    const u = new URL(v)
    if (u.protocol !== "https:" || !u.hostname.includes(".")) return null
    return u.toString()
  } catch {
    return null
  }
}

export async function checkUrlLoads(url: string, timeoutMs = 8000): Promise<UrlCheck> {
  const attempt = async (method: "HEAD" | "GET") => {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "ListHit-SiteCheck/1.0 (+https://listhit.io)" },
    })
    return res.status
  }
  try {
    let status = await attempt("HEAD")
    // Plenty of sites reject HEAD; confirm with GET before calling it broken.
    if (status >= 400) status = await attempt("GET")
    return { url, ok: status >= 200 && status < 300, status }
  } catch {
    return { url, ok: false, status: null }
  }
}
