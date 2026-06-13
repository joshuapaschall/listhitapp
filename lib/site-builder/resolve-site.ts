import { supabaseAdmin } from "@/lib/supabase/admin"
import { DEFAULT_THEME, type SiteTheme } from "./types"
import type { NavPage } from "./nav-links"
// Canonical nav helpers live in the pure, client-safe nav-links module so the
// browser Studio preview can share them; re-exported here so existing server
// importers (the published [[...path]] route) keep importing from resolve-site.
export { buildSiteNavLinks, setNavLinks, type NavPage } from "./nav-links"

// Public traffic is sessionless, so this module must use the service-role admin
// client. The anon client would return zero rows under RLS for anonymous reads.

function normalizeHost(host: string): string {
  return host.toLowerCase().trim().split(":")[0]
}

function rootDomain(): string {
  return (process.env.SITES_ROOT_DOMAIN || "listhit.io").toLowerCase()
}

export interface ResolvedSite {
  site: any
  page: any
  theme: SiteTheme
}

// Resolve a published site row from a request host (subdomain or custom domain).
// Returns null if no published site matches. Sessionless → admin client only.
// The org's primary site, used to source theme/business/persona/host for the
// owner draft preview. Prefers a published site; falls back to the oldest.
export async function getPrimarySiteForOrg(orgId: string): Promise<any | null> {
  const { data: published } = await supabaseAdmin
    .from("sites")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "published")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (published) return published

  const { data } = await supabaseAdmin
    .from("sites")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return data || null
}

export async function resolveSiteByHost(host: string): Promise<any | null> {
  const normalizedHost = normalizeHost(host)
  const root = rootDomain()

  if (normalizedHost.endsWith(`.${root}`)) {
    const slug = normalizedHost.slice(0, normalizedHost.length - (`.${root}`).length).split(".")[0]
    if (!slug) return null
    const { data } = await supabaseAdmin
      .from("sites").select("*").eq("slug", slug.toLowerCase()).eq("status", "published").maybeSingle()
    return data || null
  }

  const { data: domain } = await supabaseAdmin
    .from("site_domains").select("site_id").eq("domain", normalizedHost).eq("status", "active").maybeSingle()
  if (!domain) return null
  const { data: siteRow } = await supabaseAdmin
    .from("sites").select("*").eq("id", domain.site_id).eq("status", "published").maybeSingle()
  return siteRow || null
}

export async function resolveSite(host: string, path: string): Promise<ResolvedSite | null> {
  const site = await resolveSiteByHost(host)
  if (!site) return null

  // Load the requested page, falling back to "/" when the exact path is missing.
  let { data: page } = await supabaseAdmin
    .from("site_pages")
    .select("*")
    .eq("site_id", site.id)
    .eq("path", path)
    .maybeSingle()

  if (!page && path !== "/") {
    const fallback = await supabaseAdmin
      .from("site_pages")
      .select("*")
      .eq("site_id", site.id)
      .eq("path", "/")
      .maybeSingle()
    page = fallback.data
  }

  if (!page) return null

  const theme: SiteTheme = { ...DEFAULT_THEME, ...((site.theme_json as Partial<SiteTheme>) || {}) }

  return { site, page, theme }
}

// Shallow-clone the stored Puck data and force the Root brand props from the
// resolved theme, so the rendered site reflects the org's brand even if the
// stored page still carries template defaults.
export function mergeThemeIntoRoot(puckData: any, theme: SiteTheme): any {
  const data = { ...(puckData || {}) }
  const root = { ...(data.root || {}) }
  root.props = {
    ...(root.props || {}),
    primary: theme.primary,
    accent: theme.accent,
    headingFont: theme.headingFont,
  }
  data.root = root
  return data
}

// Sets the home AreasServed block's `areas` to the operator's per-market location
// links (replace, not append). No-op when there are no links (nationwide sites),
// leaving the block to fall back to its single-line copy or render nothing.
export function injectAreaLinks(puckData: any, links: { label: string; href: string }[]): any {
  if (!links || links.length === 0) return puckData
  const data = { ...(puckData || {}) }
  const content = Array.isArray(data.content) ? data.content.map((b: any) => ({ ...b })) : []
  for (const block of content) {
    if (block?.type === "AreasServed") {
      block.props = { ...(block.props || {}), areas: links }
    }
  }
  data.content = content
  return data
}

// Sets the home RecentPosts block's `posts` to the site's real published posts
// (replace, not append). No-op when posts is empty, leaving the block to render
// its "Start here" resources rail instead.
export function injectRecentPosts(
  puckData: any,
  posts: { title: string; date?: string; href: string; imageUrl?: string }[],
): any {
  if (!posts || posts.length === 0) return puckData
  const data = { ...(puckData || {}) }
  const content = Array.isArray(data.content) ? data.content.map((b: any) => ({ ...b })) : []
  for (const block of content) {
    if (block?.type === "RecentPosts") {
      block.props = { ...(block.props || {}), posts }
    }
  }
  data.content = content
  return data
}

// Forces the Nav block's brandName to the site's real brand whenever it holds the
// legacy "Your Company" placeholder or is empty. The wizard historically wrote a
// separate nav brandName field (defaulting to "Your Company"), so {Brand} interpolation
// never reached it and the footer (context-based) and nav (prop-based) disagreed.
// Any genuinely custom nav name is preserved.
export function injectBrandName(puckData: any, brandName?: string): any {
  if (!brandName || !brandName.trim() || brandName === "our team") return puckData
  const data = { ...(puckData || {}) }
  const content = Array.isArray(data.content) ? data.content.map((b: any) => ({ ...b })) : []
  for (const block of content) {
    if (block?.type === "Nav") {
      const cur = (block.props?.brandName || "").trim()
      if (!cur || cur === "Your Company") {
        block.props = { ...(block.props || {}), brandName }
      }
    }
  }
  data.content = content
  return data
}

// Enabled, nav-labeled sub-pages (excluding the home "/"), ordered for the nav.
export async function getNavPages(siteId: string): Promise<NavPage[]> {
  const { data } = await supabaseAdmin
    .from("site_pages")
    .select("path, nav_label, sort_order")
    .eq("site_id", siteId)
    .eq("enabled", true)
    .not("nav_label", "is", null)
    .neq("path", "/")
    .order("sort_order", { ascending: true })
  return (data || []) as NavPage[]
}
