import type { SupabaseClient } from "@supabase/supabase-js"

// Single source of truth for a site's public host/URL.
// Free subdomain root is env-driven; this is the ONLY place that holds the literal default.
const ROOT_DOMAIN = () => (process.env.SITES_ROOT_DOMAIN || "listhit.io").toLowerCase()

export function subdomainHost(slug: string): string {
  return `${slug}.${ROOT_DOMAIN()}`
}

// Best public host: active custom domain if present, else the free subdomain.
export function publicHostFor(slug: string, customDomain?: string | null): string {
  return customDomain || subdomainHost(slug)
}

export function publicUrlFor(slug: string, customDomain?: string | null): string {
  return `https://${publicHostFor(slug, customDomain)}`
}

// One query → map of siteId -> newest active custom domain.
export async function fetchPrimaryCustomDomains(
  client: SupabaseClient,
  orgId: string,
  siteIds: string[],
): Promise<Record<string, string>> {
  if (!siteIds.length) return {}
  const { data } = await client
    .from("site_domains")
    .select("site_id, domain, created_at")
    .eq("org_id", orgId)
    .eq("type", "custom")
    .eq("status", "active")
    .in("site_id", siteIds)
    .order("created_at", { ascending: false })
  const map: Record<string, string> = {}
  for (const row of ((data as any[]) || [])) {
    if (!map[row.site_id]) map[row.site_id] = row.domain // first row = newest
  }
  return map
}

// Convenience for single-site server loads.
export async function fetchSitePublicUrl(
  client: SupabaseClient,
  orgId: string,
  siteId: string,
  slug: string,
): Promise<string> {
  const map = await fetchPrimaryCustomDomains(client, orgId, [siteId])
  return publicUrlFor(slug, map[siteId])
}
