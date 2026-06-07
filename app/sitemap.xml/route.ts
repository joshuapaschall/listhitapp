import { resolveSiteByHost } from "@/lib/site-builder/resolve-site"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const host = (request.headers.get("host") || "").toLowerCase().split(":")[0]
  const site = host ? await resolveSiteByHost(host).catch(() => null) : null
  if (!site) return new Response("Not found", { status: 404 })

  const paths = new Set<string>(["/", "/properties", "/contact", "/privacy", "/terms"])
  try {
    const { data: pages } = await supabaseAdmin.from("site_pages").select("path").eq("site_id", site.id)
    for (const p of (pages || []) as Array<{ path: string | null }>) {
      if (p.path) paths.add(p.path)
    }
  } catch {
    /* fall back to the generated paths if the page query fails */
  }

  const urls = Array.from(paths).map((p) => `https://${host}${p === "/" ? "/" : p}`)
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") +
    `\n</urlset>\n`
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } })
}
