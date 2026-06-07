import { resolveSiteByHost } from "@/lib/site-builder/resolve-site"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const host = (request.headers.get("host") || "").toLowerCase().split(":")[0]
  const site = host ? await resolveSiteByHost(host).catch(() => null) : null
  const body = site
    ? `User-agent: *\nAllow: /\n\nSitemap: https://${host}/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
