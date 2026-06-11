import { supabaseAdmin } from "@/lib/supabase/admin"
import { DEFAULT_THEME, type SiteTheme } from "./types"

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

// Adds a "Blog" link to the Puck Nav block's links array (home page nav).
// Idempotent: no-op if a /blog link is already present or there is no Nav block.
export function injectBlogNavLink(puckData: any): any {
  const data = { ...(puckData || {}) }
  const content = Array.isArray(data.content) ? data.content.map((b: any) => ({ ...b })) : []
  const nav = content.find((b: any) => b?.type === "Nav")
  if (nav) {
    const links = Array.isArray(nav.props?.links) ? [...nav.props.links] : []
    const hasBlog = links.some((l: any) => (l?.href || "").replace(/\/$/, "") === "/blog")
    if (!hasBlog) {
      links.push({ label: "Blog", href: "/blog" })
      nav.props = { ...(nav.props || {}), links }
    }
  }
  data.content = content
  return data
}

export interface NavPage {
  path: string
  nav_label: string
  sort_order: number
}

// Canonical nav link list for a site, so the home Puck Nav and the shared
// sub-page <SiteHeader> agree. Order mirrors injectPageNavLinks/injectBlogNavLink:
// Home, Deals, Buyers list, then enabled sub-pages (Reviews/About/How it works/
// FAQ in their stored order), then Blog when there are posts. De-duped by href.
export function buildSiteNavLinks(opts: {
  hasPosts: boolean
  enabledPages: NavPage[]
}): { label: string; href: string }[] {
  const links: { label: string; href: string }[] = [
    { label: "Home", href: "/" },
    { label: "Deals", href: "/properties" },
    { label: "Buyers list", href: "/get-on-the-list" },
  ]
  for (const p of opts.enabledPages || []) {
    if (p?.nav_label && p?.path) links.push({ label: p.nav_label, href: p.path })
  }
  if (opts.hasPosts) links.push({ label: "Blog", href: "/blog" })

  const seen = new Set<string>()
  const norm = (h: string) => (h || "").replace(/\/$/, "") || "/"
  return links.filter((l) => {
    const key = norm(l.href)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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

// Inject nav links for enabled pages, mirroring injectBlogNavLink. Each link is
// inserted before the existing "/contact" link when present, else appended.
// Idempotent: skips any href already in the nav.
export function injectPageNavLinks(puckData: any, pages: NavPage[]): any {
  const data = { ...(puckData || {}) }
  const content = Array.isArray(data.content) ? data.content.map((b: any) => ({ ...b })) : []
  const nav = content.find((b: any) => b?.type === "Nav")
  if (nav && Array.isArray(pages) && pages.length) {
    const links = Array.isArray(nav.props?.links) ? [...nav.props.links] : []
    const norm = (h: any) => (h || "").replace(/\/$/, "")
    const contactIdx = links.findIndex((l: any) => norm(l?.href) === "/contact")
    let insertAt = contactIdx >= 0 ? contactIdx : links.length
    for (const p of pages) {
      if (!p?.nav_label || !p?.path) continue
      if (links.some((l: any) => norm(l?.href) === norm(p.path))) continue
      links.splice(insertAt, 0, { label: p.nav_label, href: p.path })
      insertAt++
    }
    nav.props = { ...(nav.props || {}), links }
  }
  data.content = content
  return data
}
