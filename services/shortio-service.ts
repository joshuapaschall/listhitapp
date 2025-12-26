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
  html: string,
  opts: { anchorHrefOnly?: boolean } = {},
): Promise<{ html: string; key: string | null }> {
  if (opts.anchorHrefOnly) {
    return replaceAnchorHrefsWithShortLinks(html)
  }
  return replaceAllUrlsWithShortLinks(html)
}

async function replaceAnchorHrefsWithShortLinks(html: string): Promise<{ html: string; key: string | null }> {
  const anchorRegex = buildAnchorHrefRegex()
  const urls = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = anchorRegex.exec(html))) {
    urls.add(match[1])
  }
  if (!urls.size) return { html, key: null }

  const replacements = new Map<string, string>()
  let firstKey: string | null = null
  for (const url of urls) {
    try {
      const { shortURL, path } = await createShortLink(url)
      replacements.set(url, shortURL)
      if (!firstKey) firstKey = path
    } catch (err) {
      console.error("Short.io failed", err)
    }
  }

  const replaceRegex = buildAnchorHrefRegex()
  const newHtml = html.replace(replaceRegex, (fullMatch, url) => {
    const shortURL = replacements.get(url)
    if (!shortURL) return fullMatch
    return fullMatch.replace(url, shortURL)
  })

  return { html: newHtml, key: firstKey }
}

async function replaceAllUrlsWithShortLinks(html: string): Promise<{ html: string; key: string | null }> {
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

function buildAnchorHrefRegex() {
  return /<a\s+[^>]*href=["'](https?:\/\/[^"'>\s]+)["'][^>]*>/gi
}

export default {
  createShortLink,
  getShortLinkClicks,
  replaceUrlsWithShortLinks,
}
