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
