import { notFound } from "next/navigation"
import { requireOrgContext } from "@/lib/auth/org-context"
import { SiteService } from "@/services/site-service"
import { DEFAULT_THEME, DEFAULT_BUSINESS, DEFAULT_MARKETS } from "@/lib/site-builder/types"
import { mergeThemeIntoRoot, buildSiteNavLinks } from "@/lib/site-builder/resolve-site"
import { cityFromMarkets } from "@/lib/site-builder/interpolate"
import { SiteStudioEditor } from "@/components/websites/site-studio-editor"

export const dynamic = "force-dynamic"

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { orgId, supabase } = await requireOrgContext()
  if (!orgId) notFound()
  const result = await SiteService.get(supabase, orgId, id)
  if (!result) notFound()
  const { site, pages } = result
  const home = (pages || []).find((p: any) => p.path === "/")
  if (!home) notFound()
  const theme = { ...DEFAULT_THEME, ...(site.theme_json || {}) }
  const sorted = [...(pages || [])].sort((a: any, b: any) => {
    if (a.path === "/") return -1
    if (b.path === "/") return 1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
  const editablePages = sorted.map((p: any) => ({
    path: p.path,
    label: p.path === "/" ? "Home" : (p.nav_label || p.title || p.path),
    data: mergeThemeIntoRoot(p.puck_data, theme),
  }))
  const business = { ...DEFAULT_BUSINESS, ...((site.business_json as any) || {}) }
  const markets = { ...DEFAULT_MARKETS, ...((site.markets_json as any) || {}) }
  const city = cityFromMarkets(markets)
  const enabledPages = (pages || [])
    .filter((p: any) => p.enabled !== false && p.nav_label && p.path !== "/")
    .map((p: any) => ({ path: p.path, nav_label: p.nav_label, sort_order: p.sort_order ?? 0 }))
  const navLinks = buildSiteNavLinks({ hasPosts: false, enabledPages })
  return (
    <SiteStudioEditor
      siteId={site.id}
      slug={site.slug || ""}
      siteName={site.name || ""}
      status={site.status || "draft"}
      pages={editablePages}
      business={business}
      markets={markets}
      persona={site.persona}
      navLinks={navLinks}
      city={city}
    />
  )
}
