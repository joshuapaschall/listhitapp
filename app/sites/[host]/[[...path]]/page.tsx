import type { Metadata } from "next"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { resolveSite, mergeThemeIntoRoot, resolveSiteByHost } from "@/lib/site-builder/resolve-site"
import { DEFAULT_THEME, DEFAULT_BUSINESS, DEFAULT_MARKETS } from "@/lib/site-builder/types"
import { buildTermsAndPrivacy, buildContactDoc, buildOptInDisclosure } from "@/lib/site-builder/compliance"
import { SiteRendererRSC } from "@/components/sites/site-renderer-rsc"
import { SiteJsonLd } from "@/components/sites/site-json-ld"
import { LegalPage } from "@/components/sites/legal-page"
import { PropertiesPage } from "@/components/sites/properties-page"
import { PropertyPage } from "@/components/sites/property-page"
import { PropertyJsonLd } from "@/components/sites/property-json-ld"
import {
  getPublishedDeals,
  getPublishedDealCount,
  getPublishedDealBySlug,
  getNearbyPublishedDeals,
  getPublishedDealsForMarket,
} from "@/services/site-deals-service"
import { resolveLocationPage, locationHrefForDeal, PERSONA_URL_SLUG } from "@/lib/site-builder/location-pages"
import { locationCopy } from "@/lib/site-builder/location-content"
import { LocationPage } from "@/components/sites/location-page"

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

function seoMeta(host: string, path: string, title: string, description: string | undefined, siteName: string): Metadata {
  const canonical = path && path !== "/" ? path : "/"
  return {
    title,
    description,
    metadataBase: new URL(`https://${host}`),
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  }
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
      return seoMeta(host, path, `${doc.title} · ${site.name}`, undefined, site.name)
    }

    if (path === "/properties") {
      const site = await resolveSiteByHost(host)
      if (!site) return { title: "Site not found" }
      return seoMeta(host, path, `Available deals · ${site.name}`, `Browse available off-market deals from ${site.name}.`, site.name)
    }

    if (params.path?.length === 2 && params.path[0] === "properties") {
      const slug = params.path[1]
      const site = await resolveSiteByHost(host)
      if (!site || site.deals_public === false) return { title: "Not found", robots: { index: false } }
      const deal = await getPublishedDealBySlug(site.org_id, slug).catch(() => null)
      if (!deal) return { title: "Not found", robots: { index: false } }
      const cityState = [deal.city, deal.state].filter(Boolean).join(", ")
      const title = deal.address
        ? `${[deal.address, cityState].filter(Boolean).join(", ")}`
        : `${deal.bedrooms ?? ""}BR investment property in ${cityState || "your market"}`.trim()
      const priceBit = deal.price != null ? `$${Math.round(deal.price).toLocaleString("en-US")} ` : ""
      const specBit = [
        deal.bedrooms != null ? `${deal.bedrooms} bed` : null,
        deal.bathrooms != null ? `${deal.bathrooms} bath` : null,
      ]
        .filter(Boolean)
        .join(", ")
      const desc = `${priceBit}off-market deal${specBit ? ` — ${specBit}` : ""}${cityState ? ` in ${cityState}` : ""}. Join ${site.name}'s buyers list for full address & details.`
      const meta = seoMeta(host, `/properties/${slug}`, `${title} · ${site.name}`, desc, site.name)
      return { ...meta, robots: { index: true, follow: true } }
    }

    if (params.path?.length === 2) {
      const site = await resolveSiteByHost(host)
      if (site) {
        const match = resolveLocationPage(site, params.path)
        if (match) {
          const copy = locationCopy(match.persona, match.market, site.name)
          return { ...seoMeta(host, path, copy.title, copy.metaDescription, site.name), robots: { index: true, follow: true } }
        }
      }
    }

    const result = await resolveSite(host, path)
    if (!result) return { title: "Site not found" }
    return seoMeta(host, path, result.page.title || result.site.name, result.page.meta_description || undefined, result.site.name)
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

  if (path === "/properties") {
    const site = await resolveSiteByHost(host)
    if (!site) notFound()
    const theme = { ...DEFAULT_THEME, ...(site.theme_json || {}) }
    const business = { ...DEFAULT_BUSINESS, ...(site.business_json || {}) }
    const publicMode = site.deals_public !== false
    const unlocked = cookies().get("lh_deals_unlocked")?.value === "1"
    const formContext = {
      persona: site.persona,
      brandName: site.name,
      optinEnabled: business.optin?.enabled !== false,
      requireConsent: business.optin?.requireConsent !== false,
      disclosure: buildOptInDisclosure(site.name),
      legalPaths: { terms: "/terms", privacy: "/privacy" },
      markets: { ...DEFAULT_MARKETS, ...((site.markets_json as any) || {}) },
      deals: [],
      business,
    }
    // Public sites: full, ungated list — every card links to its indexable
    // detail page. No address stripping, no cookie gate.
    if (publicMode) {
      const deals = await getPublishedDeals(site.org_id, 24).catch(() => [])
      return <PropertiesPage brandName={site.name} theme={theme} business={business} formContext={formContext} publicMode unlocked deals={deals} count={deals.length} />
    }
    if (unlocked) {
      const deals = await getPublishedDeals(site.org_id, 24).catch(() => [])
      return <PropertiesPage brandName={site.name} theme={theme} business={business} formContext={formContext} unlocked deals={deals} count={deals.length} />
    }
    const [count, teaser] = await Promise.all([
      getPublishedDealCount(site.org_id).catch(() => 0),
      getPublishedDeals(site.org_id, 6).catch(() => []),
    ])
    // Locked gate shows real photos/price/city as proof, but the street address
    // — the carrot — is stripped server-side so it never reaches the client.
    const lockedDeals = teaser.map((d) => ({ ...d, address: null }))
    return <PropertiesPage brandName={site.name} theme={theme} business={business} formContext={formContext} unlocked={false} deals={lockedDeals} count={count} />
  }

  // Individual property detail page — public + indexable when deals_public.
  if (params.path?.length === 2 && params.path[0] === "properties") {
    const site = await resolveSiteByHost(host)
    if (!site || site.deals_public === false) notFound()
    const deal = await getPublishedDealBySlug(site.org_id, params.path[1])
    if (!deal) notFound()
    const theme = { ...DEFAULT_THEME, ...(site.theme_json || {}) }
    const business = { ...DEFAULT_BUSINESS, ...(site.business_json || {}) }
    const nearby = await getNearbyPublishedDeals(site.org_id, deal.city, deal.state, deal.id, 3).catch(() => [])
    const formContext = {
      persona: site.persona,
      brandName: site.name,
      optinEnabled: business.optin?.enabled !== false,
      requireConsent: business.optin?.requireConsent !== false,
      disclosure: buildOptInDisclosure(site.name),
      legalPaths: { terms: "/terms", privacy: "/privacy" },
      markets: { ...DEFAULT_MARKETS, ...((site.markets_json as any) || {}) },
      deals: nearby,
      business,
    }
    // Deep-link the breadcrumb to this property's city (or state) landing page
    // when the site runs specific markets; null on nationwide sites.
    const cityLocationHref = locationHrefForDeal(site, deal.city, deal.state)
    return (
      <>
        <PropertyJsonLd deal={deal} host={host} brandName={site.name} />
        <PropertyPage host={host} site={site} theme={theme} business={business} deal={deal} nearby={nearby} formContext={formContext} cityLocationHref={cityLocationHref} />
      </>
    )
  }

  // Programmatic location landing pages (e.g. /investment-properties/atlanta-ga)
  // for sites running specific markets. Nationwide sites have none.
  if (params.path?.length === 2 && params.path[0] !== "properties") {
    const site = await resolveSiteByHost(host)
    const match = site ? resolveLocationPage(site, params.path) : null
    // A claimed persona prefix on a specific-market site but an unknown market
    // is a 404 — don't silently fall through to the home page.
    if (site && PERSONA_URL_SLUG[site.persona as keyof typeof PERSONA_URL_SLUG] === params.path[0] && site.markets_json?.scope === "specific" && !match) {
      notFound()
    }
    if (site && match) {
      const theme = { ...DEFAULT_THEME, ...(site.theme_json || {}) }
      const business = { ...DEFAULT_BUSINESS, ...(site.business_json || {}) }
      const deals = await getPublishedDealsForMarket(site.org_id, match.market, 6).catch(() => [])
      const formContext = {
        persona: site.persona,
        brandName: site.name,
        optinEnabled: business.optin?.enabled !== false,
        requireConsent: business.optin?.requireConsent !== false,
        disclosure: buildOptInDisclosure(site.name),
        legalPaths: { terms: "/terms", privacy: "/privacy" },
        markets: { ...DEFAULT_MARKETS, ...((site.markets_json as any) || {}) },
        deals,
        business,
      }
      const copy = locationCopy(match.persona, match.market, site.name)
      return (
        <>
          <SiteJsonLd
            brandName={site.name}
            host={host}
            business={business}
            areaServed={{ city: match.market.kind === "city" ? match.market.place : undefined, state: match.market.stateId }}
          />
          <LocationPage host={host} site={site} theme={theme} business={business} copy={copy} formContext={formContext} />
        </>
      )
    }
  }

  const result = await resolveSite(host, path)
  if (!result) notFound()

  const data = mergeThemeIntoRoot(result.page.puck_data, result.theme)

  const business = { ...DEFAULT_BUSINESS, ...((result.site.business_json as any) || {}) }
  const deals = await getPublishedDeals(result.site.org_id, 6).catch(() => [])
  const formContext = {
    persona: result.site.persona,
    brandName: result.site.name,
    optinEnabled: business.optin?.enabled !== false,
    requireConsent: business.optin?.requireConsent !== false,
    disclosure: buildOptInDisclosure(result.site.name),
    legalPaths: { terms: "/terms", privacy: "/privacy" },
    markets: { ...DEFAULT_MARKETS, ...((result.site.markets_json as any) || {}) },
    deals,
    business,
  }

  return (
    <>
      <SiteJsonLd brandName={result.site.name} host={host} business={business} />
      <SiteRendererRSC data={data} theme={result.theme} form={formContext} />
    </>
  )
}
