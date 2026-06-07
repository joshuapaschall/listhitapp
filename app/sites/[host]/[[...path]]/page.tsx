import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { resolveSite, mergeThemeIntoRoot, resolveSiteByHost } from "@/lib/site-builder/resolve-site"
import { DEFAULT_THEME, DEFAULT_BUSINESS } from "@/lib/site-builder/types"
import { buildTermsAndPrivacy, buildContactDoc } from "@/lib/site-builder/compliance"
import { SiteRenderer } from "@/components/sites/site-renderer"
import { LegalPage } from "@/components/sites/legal-page"

// Public tenant sites read published rows from the DB at request time, so this
// route is never prerendered at build.
export const dynamic = "force-dynamic"

interface SitePageParams {
  host: string
  path?: string[]
}

// Legal/contact pages are generated (always in sync, never editable into
// non-compliance) — handled before the Puck flow. /privacy and /terms render
// the SAME combined document.
const LEGAL_PATHS: Record<string, "legal" | "contact"> = {
  "/privacy": "legal",
  "/terms": "legal",
  "/contact": "contact",
}

function normalizePath(path?: string[]): string {
  const joined = "/" + (path?.join("/") ?? "")
  return joined.replace(/\/{2,}/g, "/")
}

export async function generateMetadata({
  params,
}: {
  params: SitePageParams
}): Promise<Metadata> {
  try {
    const host = decodeURIComponent(params.host)
    const path = normalizePath(params.path)

    const legalKind = LEGAL_PATHS[path]
    if (legalKind) {
      const site = await resolveSiteByHost(host)
      if (!site) return { title: "Site not found" }
      const business = { ...DEFAULT_BUSINESS, ...(site.business_json || {}) }
      const doc = legalKind === "legal" ? buildTermsAndPrivacy(site.name, business) : buildContactDoc(site.name, business)
      return { title: `${doc.title} · ${site.name}` }
    }

    const result = await resolveSite(host, path)
    if (!result) return { title: "Site not found" }
    return {
      title: result.page.title || result.site.name,
      description: result.page.meta_description || undefined,
    }
  } catch {
    return { title: "Site not found" }
  }
}

export default async function SitePage({ params }: { params: SitePageParams }) {
  const host = decodeURIComponent(params.host)
  const path = normalizePath(params.path)

  const legalKind = LEGAL_PATHS[path]
  if (legalKind) {
    const site = await resolveSiteByHost(host)
    if (!site) notFound()
    const theme = { ...DEFAULT_THEME, ...(site.theme_json || {}) }
    const business = { ...DEFAULT_BUSINESS, ...(site.business_json || {}) }
    const doc = legalKind === "legal" ? buildTermsAndPrivacy(site.name, business) : buildContactDoc(site.name, business)
    return <LegalPage doc={doc} brandName={site.name} phone={business.phone} theme={theme} />
  }

  const result = await resolveSite(host, path)
  if (!result) notFound()

  const data = mergeThemeIntoRoot(result.page.puck_data, result.theme)

  return <SiteRenderer data={data} theme={result.theme} />
}
