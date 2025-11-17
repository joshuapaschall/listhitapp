export async function createShortLink(
  originalURL: string,
  path?: string
): Promise<{ shortURL: string; path: string; idString: string }> {
  const apiKey = process.env.SHORTIO_API_KEY
  const domain = process.env.SHORTIO_DOMAIN
  if (!apiKey || !domain) {
    throw new Error("Short.io not configured")
  }
  const res = await fetch("https://api.short.io/links", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      originalURL,
      domain,
      allowDuplicates: false,
      path,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Short.io error ${res.status}: ${text}`)
  }
  const data = await res.json()
  return {
    shortURL: data.shortURL,
    path: data.path,
    idString: data.idString,
  }
}

export async function getShortLinkClicks(key: string): Promise<number> {
  const apiKey = process.env.SHORTIO_API_KEY
  const domain = process.env.SHORTIO_DOMAIN
  if (!apiKey || !domain) {
    throw new Error("Short.io not configured")
  }
  const url = `https://api.short.io/links/expand?domain=${encodeURIComponent(domain)}&path=${encodeURIComponent(key)}`
  const res = await fetch(url, {
    headers: { Authorization: apiKey },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Short.io error ${res.status}: ${text}`)
  }
  const data = await res.json()
  return data.clicks || data.statistics?.clicks || 0
}

export async function replaceUrlsWithShortLinks(
  html: string
): Promise<{ html: string; key: string | null }> {
  const regex = /(https?:\/\/[^\s"'>]+)/g
  const matches = Array.from(new Set(html.match(regex) || []))
  if (matches.length === 0) return { html, key: null }
  let newHtml = html
  let firstKey: string | null = null
  for (const url of matches) {
    try {
      const { shortURL, path } = await createShortLink(url)
      newHtml = newHtml.split(url).join(shortURL)
      if (!firstKey) firstKey = path
    } catch (err) {
      console.error("Short.io failed", err)
    }
  }
  return { html: newHtml, key: firstKey }
}

export default {
  createShortLink,
  getShortLinkClicks,
  replaceUrlsWithShortLinks,
}
