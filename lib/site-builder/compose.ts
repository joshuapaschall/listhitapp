// Client-safe composition helpers for the Website Studio wizard. This runs in
// the browser, so it must not pull in any server-only modules (no DB client,
// no service-role admin, no host-resolution code).

import { getSiteTemplate, ALL_SITE_TEMPLATES } from "@/lib/site-builder/templates"
import type { SitePersona, SiteTemplateId, SiteTheme } from "@/lib/site-builder/types"

export interface WizardContent {
  brandName: string
  phone: string
  headline: string
  subhead: string
  ctaLabel: string
  heroImageUrl: string
  footerText: string
  announcementText: string
}

export const CURATED_HERO_IMAGES: { label: string; url: string }[] = [
  { label: "Suburban home", url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1600&q=80" },
  { label: "Keys in hand", url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1600&q=80" },
  { label: "Modern exterior", url: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1600&q=80" },
  { label: "Cozy living room", url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80" },
  { label: "Front porch", url: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=1600&q=80" },
  { label: "Neighborhood street", url: "https://images.unsplash.com/photo-1448630360428-65456885c650?w=1600&q=80" },
]

function firstOfType(content: any[], type: string): any | undefined {
  return content.find((c) => c?.type === type)
}

// Clone the Puck data and merge wizard content into the first block of each
// type, plus force the Root brand props from the theme. Pure, client-side.
export function applyContentToPuck(data: any, content: Partial<WizardContent>, theme: SiteTheme): any {
  const clone = JSON.parse(JSON.stringify(data || {}))
  const items: any[] = Array.isArray(clone.content) ? clone.content : []

  const hero = firstOfType(items, "Hero")
  if (hero) {
    hero.props = {
      ...(hero.props || {}),
      ...(content.headline !== undefined ? { headline: content.headline } : {}),
      ...(content.subhead !== undefined ? { subhead: content.subhead } : {}),
      ...(content.ctaLabel !== undefined ? { ctaLabel: content.ctaLabel } : {}),
      ...(content.heroImageUrl !== undefined ? { imageUrl: content.heroImageUrl } : {}),
    }
  }

  const nav = firstOfType(items, "Nav")
  if (nav) {
    nav.props = {
      ...(nav.props || {}),
      ...(content.brandName !== undefined ? { brandName: content.brandName } : {}),
      ...(content.phone !== undefined ? { phone: content.phone } : {}),
      logoUrl: theme.logoUrl || "",
      layout: theme.headerLayout,
    }
  }

  const footer = firstOfType(items, "Footer")
  if (footer && content.footerText !== undefined) {
    footer.props = { ...(footer.props || {}), text: content.footerText }
  }

  const announcement = firstOfType(items, "AnnouncementBar")
  if (announcement) {
    announcement.props = {
      ...(announcement.props || {}),
      ...(content.announcementText !== undefined ? { text: content.announcementText } : {}),
      enabled: theme.banner ? "show" : "hide",
    }
  }

  clone.content = items
  clone.root = {
    ...(clone.root || {}),
    props: {
      ...((clone.root && clone.root.props) || {}),
      primary: theme.primary,
      accent: theme.accent,
      headingFont: theme.headingFont,
      bodyFont: theme.bodyFont,
    },
  }
  return clone
}

// Client-safe mirror of resolve-site.ts#injectPageNavLinks. Inserts a nav link
// for each enabled sub-page before the "/contact" link (else appended).
// Idempotent: skips any href already present. Pure — safe in the browser.
export function injectNavPages(data: any, pages: { path: string; navLabel: string }[]): any {
  if (!Array.isArray(pages) || !pages.length) return data
  const clone = JSON.parse(JSON.stringify(data || {}))
  const items: any[] = Array.isArray(clone.content) ? clone.content : []
  const nav = items.find((b) => b?.type === "Nav")
  if (nav) {
    const links = Array.isArray(nav.props?.links) ? [...nav.props.links] : []
    const norm = (h: any) => (h || "").replace(/\/$/, "")
    const contactIdx = links.findIndex((l: any) => norm(l?.href) === "/contact")
    let at = contactIdx >= 0 ? contactIdx : links.length
    for (const p of pages) {
      if (!p?.navLabel || !p?.path) continue
      if (links.some((l: any) => norm(l?.href) === norm(p.path))) continue
      links.splice(at, 0, { label: p.navLabel, href: p.path })
      at++
    }
    nav.props = { ...(nav.props || {}), links }
  }
  clone.content = items
  return clone
}

export function composePreview(
  templateId: SiteTemplateId,
  persona: SitePersona,
  theme: SiteTheme,
  content: Partial<WizardContent>,
  navPages: { path: string; navLabel: string }[] = [],
): any {
  const tpl = getSiteTemplate(templateId) || ALL_SITE_TEMPLATES[0]
  const base = tpl.build(persona)
  return injectNavPages(applyContentToPuck(base, content, theme), navPages)
}

// Hydrate a WizardContent from stored Puck data (edit mode). Blanks → "".
export function extractContent(puckData: any): WizardContent {
  const items: any[] = Array.isArray(puckData?.content) ? puckData.content : []
  const hero = firstOfType(items, "Hero")?.props || {}
  const nav = firstOfType(items, "Nav")?.props || {}
  const footer = firstOfType(items, "Footer")?.props || {}
  const announcement = firstOfType(items, "AnnouncementBar")?.props || {}
  return {
    brandName: nav.brandName || "",
    phone: nav.phone || "",
    headline: hero.headline || "",
    subhead: hero.subhead || "",
    ctaLabel: hero.ctaLabel || "",
    heroImageUrl: hero.imageUrl || "",
    footerText: footer.text || "",
    announcementText: announcement.text || "",
  }
}
