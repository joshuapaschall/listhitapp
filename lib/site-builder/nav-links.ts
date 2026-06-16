// Pure, client-safe canonical nav helpers. Shared by the server render path
// (resolve-site.ts / the published [[...path]] route) AND the browser Website
// Studio preview (compose.ts / site-preview.tsx), so the preview header + footer
// always match what publishes. MUST stay pure: no DB client, no admin import.

export interface NavPage {
  path: string
  nav_label: string
  sort_order: number
}

// Canonical site nav, single source of truth:
// Home → Deals → enabled sub-pages incl. Blog (in sort order) → Contact.
// Phone + "Get deals" CTA are rendered separately by SiteHeader and are NOT in this list.
export function buildSiteNavLinks(opts: {
  hasPosts: boolean
  enabledPages: NavPage[]
}): { label: string; href: string }[] {
  const links: { label: string; href: string }[] = [
    { label: "Home", href: "/" },
    { label: "Deals", href: "/properties" },
  ]
  for (const p of opts.enabledPages || []) {
    if (p?.nav_label && p?.path) links.push({ label: p.nav_label, href: p.path })
  }
  links.push({ label: "Contact", href: "/contact" })

  const seen = new Set<string>()
  const norm = (h: string) => (h || "").replace(/\/$/, "") || "/"
  return links.filter((l) => {
    const key = norm(l.href)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Force the Puck Nav block's links to the canonical list (replace, not append). No-op if no Nav block.
export function setNavLinks(puckData: any, links: { label: string; href: string }[]): any {
  const data = { ...(puckData || {}) }
  const content = Array.isArray(data.content) ? data.content.map((b: any) => ({ ...b })) : []
  for (const block of content) {
    if (block?.type === "Nav") {
      block.props = { ...(block.props || {}), links }
    }
  }
  data.content = content
  return data
}
