// app/sites/[host]/blog/feed/route.ts
import { resolveSiteByHost } from "@/lib/site-builder/resolve-site"
import { getPublishedPosts } from "@/services/site-posts-service"

export const dynamic = "force-dynamic"

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ host: string }> },
) {
  const { host } = await context.params
  const decodedHost = decodeURIComponent(host)
  const site = await resolveSiteByHost(decodedHost).catch(() => null)
  if (!site) {
    return new Response("Not found", { status: 404 })
  }

  const base = `https://${decodedHost}`
  const posts = await getPublishedPosts(site.id, site.org_id, 50).catch(() => [])

  const items = posts
    .map((p) => {
      const link = `${base}/blog/${p.slug}`
      const pubDate = p.publishedAt ? new Date(p.publishedAt).toUTCString() : ""
      const desc = p.excerpt || ""
      return [
        "    <item>",
        `      <title>${escapeXml(p.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        pubDate ? `      <pubDate>${pubDate}</pubDate>` : "",
        desc ? `      <description>${escapeXml(desc)}</description>` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n")
    })
    .join("\n")

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(site.name)} — Blog</title>`,
    `    <link>${escapeXml(`${base}/blog`)}</link>`,
    `    <description>${escapeXml(`Latest posts from ${site.name}`)}</description>`,
    `    <atom:link href="${escapeXml(`${base}/blog/feed`)}" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom" />`,
    items,
    "  </channel>",
    "</rss>",
  ].join("\n")

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=600",
    },
  })
}
