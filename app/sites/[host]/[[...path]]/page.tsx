import type { Metadata } from "next"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { resolveSite, mergeThemeIntoRoot, resolveSiteByHost, injectBlogNavLink, getNavPages, injectPageNavLinks, injectAreaLinks } from "@/lib/site-builder/resolve-site"
import { DEFAULT_THEME, DEFAULT_BUSINESS, DEFAULT_MARKETS, type SitePersona } from "@/lib/site-builder/types"
import { cityFromMarkets } from "@/lib/site-builder/interpolate"
import { pageSeo } from "@/lib/site-builder/seo"
import { buildPrivacyPolicy, buildTermsOfService, buildContactDoc, buildConsentTexts } from "@/lib/site-builder/compliance"
import { supabaseAdmin } from "@/lib/supabase"
import { SiteRendererRSC } from "@/components/sites/site-renderer-rsc"
import { SiteJsonLd } from "@/components/sites/site-json-ld"
import { LegalPage } from "@/components/sites/legal-page"
import { BuyerProfilePage } from "@/components/sites/buyer-profile-page"
import { WelcomePage } from "@/components/sites/welcome-page"
import { PropertiesPage } from "@/components/sites/properties-page"
import { PropertyPage } from "@/components/sites/property-page"
import { PropertyJsonLd } from "@/components/sites/property-json-ld"
import {
  getPublishedDeals,
  getPublishedDealCount,
  getPublishedDealBySlug,
  getNearbyPublishedDeals,
  getPublishedDealsForMarket,
  type DealFilters,
} from "@/services/site-deals-service"
import { resolveLocationPage, locationHrefForDeal, PERSONA_URL_SLUG, buildAreaLinks } from "@/lib/site-builder/location-pages"
import { locationCopy } from "@/lib/site-builder/location-content"
import { LocationPage } from "@/components/sites/location-page"
import { getPublishedPosts, getPublishedPostBySlug, getPublishedPostCount } from "@/services/site-posts-service"
import { BlogIndexPage } from "@/components/sites/blog-index-page"
import { BlogPostPage } from "@/components/sites/blog-post-page"
import { PostJsonLd } from "@/components/sites/post-json-ld"

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
const LEGAL_PATHS: Record<string, "privacy" | "terms" | "contact"> = {
  "/privacy": "privacy",
  "/terms": "terms",
  "/contact": "contact",
}

function normalizePath(path?: string[]): string {
  const joined = "/" + (path?.join("/") ?? "")
  return joined.replace(/\/{2,}/g, "/")
}

// Parse the public /properties buyer filter from the URL search params into a
// server-side DealFilters plus the seed values the client filter bar reflects.
function readDealFilters(sp: Record<string, string | string[] | undefined> | undefined) {
  const get = (k: string) => {
    const val = sp?.[k]
    return Array.isArray(val) ? val[0] : val
  }
  const bedsN = parseInt(get("beds") || "0", 10) || 0
  const bathsN = parseInt(get("baths") || "0", 10) || 0
  const termsRaw = get("terms") || "any"
  const allowedTerms = ["cash", "owner_finance", "subject_to", "land_contract"]
  const terms = allowedTerms.includes(termsRaw) ? termsRaw : "any"
  const sortRaw = get("sort") || "new"
  const sort: DealFilters["sort"] = sortRaw === "price_asc" || sortRaw === "price_desc" ? sortRaw : "new"
  const filters: DealFilters = {
    minBeds: bedsN > 0 ? bedsN : undefined,
    minBaths: bathsN > 0 ? bathsN : undefined,
    terms: terms !== "any" ? terms : undefined,
    sort,
  }
  const values = { sort: sort || "new", beds: String(bedsN), baths: String(bathsN), terms }
  return { filters, values }
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

    // Lead-flow pages are transactional — never index them.
    if (path === "/get-on-the-list" || path === "/welcome") {
      return { title: "Get on the list", robots: { index: false, follow: false } }
    }

    const legalKind = LEGAL_PATHS[path]
    if (legalKind) {
      const site = await resolveSiteByHost(host)
      if (!site) return { title: "Site not found" }
      const business = { ...DEFAULT_BUSINESS, ...(site.business_json || {}) }
      const args = legalKind === "contact" ? null : await legalArgsFor(site, business)
      const doc = buildLegalDoc(legalKind, args, site, business)
      return seoMeta(host, path, `${doc.title} · ${site.name}`, undefined, site.name)
    }

    if (path === "/properties") {
      const site = await resolveSiteByHost(host)
      if (!site) return { title: "Site not found" }
      return { ...seoMeta(host, path, `Available deals · ${site.name}`, `Browse available off-market deals from ${site.name}.`, site.name), alternates: { canonical: `https://${host}/properties` } }
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

    // Blog index — must precede the 2-segment location branch below.
    if (params.path?.length === 1 && params.path[0] === "blog") {
      const site = await resolveSiteByHost(host)
      if (!site) return { title: "Site not found" }
      return seoMeta(host, "/blog", `Blog | ${site.name}`, `Latest articles and updates from ${site.name}.`, site.name)
    }

    // Blog post — must precede the 2-segment location branch (it also matches length===2).
    if (params.path?.length === 2 && params.path[0] === "blog") {
      const site = await resolveSiteByHost(host)
      if (!site) return { title: "Site not found" }
      const post = await getPublishedPostBySlug(site.id, site.org_id, params.path[1]).catch(() => null)
      if (!post) return { title: "Not found", robots: { index: false } }
      const ogImage = post.ogImageUrl || post.featuredImageUrl || undefined
      const meta = seoMeta(
        host,
        `/blog/${post.slug}`,
        post.metaTitle || post.title,
        post.metaDescription || post.excerpt || undefined,
        site.name,
      )
      return {
        ...meta,
        robots: { index: true, follow: true },
        openGraph: { ...meta.openGraph, images: ogImage ? [ogImage] : undefined },
      }
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

    // Operator override: a custom meta_description set in the studio wins.
    if (result.page.meta_description) {
      return seoMeta(host, path, result.page.title || result.site.name, result.page.meta_description, result.site.name)
    }
    // Otherwise auto-generate keyword-first SEO from the persona + market.
    const brand = (result.site.name || "").trim()
    const city = cityFromMarkets((result.site.markets_json as any) || null)
    const seo = pageSeo(result.site.persona as SitePersona, path, brand, city)
    if (seo) {
      return { ...seoMeta(host, path, seo.title, seo.description, result.site.name), robots: { index: true, follow: true } }
    }
    return seoMeta(host, path, result.page.title || result.site.name, result.page.meta_description || undefined, result.site.name)
  } catch {
    return { title: "Site not found" }
  }
}

// Build the form's opt-in context for a resolved site. Opt-in is always on and
// the two consent labels are auto-populated with the org's legal business name
// (from business_verification, falling back to the site name). System wording —
// not user-editable. `disclosure` mirrors the marketing text so any existing
// consent_text plumbing still gets a ≥50-char string.
async function buildOptinContext(site: any) {
  const { data: row } = await supabaseAdmin
    .from("business_verification")
    .select("legal_business_name")
    .eq("org_id", site.org_id)
    .maybeSingle()
  const legalName = row?.legal_business_name?.trim() || site.name
  const consent = buildConsentTexts(legalName)
  const brand = (site.name || "").trim()
  const legalDisplay = brand && brand !== legalName.trim() ? `${legalName} DBA ${brand}` : legalName
  return {
    optinEnabled: true,
    requireConsent: true,
    disclosure: consent.marketing,
    consentMarketing: consent.marketing,
    consentNonMarketing: consent.nonMarketing,
    legalDisplay,
  }
}

// Auto-populated args for the legal documents. Contact details come from the org
// so they match the A2P application; legal name comes from business_verification.
async function legalArgsFor(site: any, business: any) {
  const [{ data: ver }, { data: org }] = await Promise.all([
    supabaseAdmin
      .from("business_verification")
      .select("legal_business_name")
      .eq("org_id", site.org_id)
      .maybeSingle(),
    supabaseAdmin.from("organizations").select("website_url").eq("id", site.org_id).maybeSingle(),
  ])
  const legalName = ver?.legal_business_name?.trim() || site.name
  const cityState = [business.city, business.state].filter(Boolean).join(", ")
  const address = [business.address, cityState, business.zip].filter(Boolean).join(", ")
  return {
    legalName,
    brand: site.name,
    phone: business.phone || "",
    email: business.email || "",
    website: (org?.website_url && org.website_url.trim()) || `https://${site.slug}.listhit.io`,
    address,
  }
}

function buildLegalDoc(kind: "privacy" | "terms" | "contact", args: any, site: any, business: any) {
  if (kind === "privacy") return buildPrivacyPolicy(args)
  if (kind === "terms") return buildTermsOfService(args)
  return buildContactDoc(site.name, business)
}

export default async function SitePage({
  params,
  searchParams,
}: {
  params: SitePageParams
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const host = decodeURIComponent(params.host)
  const path = normalizePath(params.path)

  const legalKind = LEGAL_PATHS[path]
  if (legalKind) {
    const site = await resolveSiteByHost(host)
    if (!site) notFound()
    const theme = { ...DEFAULT_THEME, ...(site.theme_json || {}) }
    const business = { ...DEFAULT_BUSINESS, ...(site.business_json || {}) }
    const args = legalKind === "contact" ? null : await legalArgsFor(site, business)
    const doc = buildLegalDoc(legalKind, args, site, business)
    return <LegalPage doc={doc} brandName={site.name} phone={business.phone} theme={theme} />
  }

  // Lead flow — dedicated Step-2 profile page and Step-3 success page. Reserved
  // paths take precedence over Puck content (same as the other reserved paths).
  if (path === "/get-on-the-list") {
    const site = await resolveSiteByHost(host)
    if (!site) notFound()
    const theme = { ...DEFAULT_THEME, ...(site.theme_json || {}) }
    const optin = await buildOptinContext(site)
    return (
      <BuyerProfilePage
        persona={site.persona}
        brandName={site.name}
        theme={theme}
        consentText={optin.consentMarketing || optin.disclosure}
      />
    )
  }

  if (path === "/welcome") {
    const site = await resolveSiteByHost(host)
    if (!site) notFound()
    const theme = { ...DEFAULT_THEME, ...(site.theme_json || {}) }
    return <WelcomePage brandName={site.name} theme={theme} />
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
      ...(await buildOptinContext(site)),
      legalPaths: { terms: "/terms", privacy: "/privacy" },
      markets: { ...DEFAULT_MARKETS, ...((site.markets_json as any) || {}) },
      deals: [],
      business,
    }
    const { filters, values } = readDealFilters(searchParams)
    // Public sites: full, ungated list — every card links to its indexable
    // detail page. No address stripping, no cookie gate.
    if (publicMode) {
      const [deals, count] = await Promise.all([
        getPublishedDeals(site.org_id, 24, 0, filters).catch(() => []),
        getPublishedDealCount(site.org_id, filters).catch(() => 0),
      ])
      return <PropertiesPage brandName={site.name} theme={theme} business={business} formContext={formContext} publicMode unlocked deals={deals} count={count} filters={values} />
    }
    if (unlocked) {
      const [deals, count] = await Promise.all([
        getPublishedDeals(site.org_id, 24, 0, filters).catch(() => []),
        getPublishedDealCount(site.org_id, filters).catch(() => 0),
      ])
      return <PropertiesPage brandName={site.name} theme={theme} business={business} formContext={formContext} unlocked deals={deals} count={count} filters={values} />
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
      ...(await buildOptinContext(site)),
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

  // Blog index — must precede the 2-segment location branch below.
  if (params.path?.length === 1 && params.path[0] === "blog") {
    const site = await resolveSiteByHost(host)
    if (!site) notFound()
    const theme = { ...DEFAULT_THEME, ...(site.theme_json || {}) }
    const business = { ...DEFAULT_BUSINESS, ...(site.business_json || {}) }
    const deals = await getPublishedDeals(site.org_id, 6).catch(() => [])
    const posts = await getPublishedPosts(site.id, site.org_id, 12).catch(() => [])
    const formContext = {
      persona: site.persona,
      brandName: site.name,
      ...(await buildOptinContext(site)),
      legalPaths: { terms: "/terms", privacy: "/privacy" },
      markets: { ...DEFAULT_MARKETS, ...((site.markets_json as any) || {}) },
      deals,
      business,
    }
    return <BlogIndexPage host={host} site={site} theme={theme} business={business} formContext={formContext} posts={posts} />
  }

  // Blog post — must precede the 2-segment location branch (it also matches length===2).
  if (params.path?.length === 2 && params.path[0] === "blog") {
    const site = await resolveSiteByHost(host)
    if (!site) notFound()
    const post = await getPublishedPostBySlug(site.id, site.org_id, params.path[1])
    if (!post) notFound()
    const theme = { ...DEFAULT_THEME, ...(site.theme_json || {}) }
    const business = { ...DEFAULT_BUSINESS, ...(site.business_json || {}) }
    const deals = await getPublishedDeals(site.org_id, 6).catch(() => [])
    const formContext = {
      persona: site.persona,
      brandName: site.name,
      ...(await buildOptinContext(site)),
      legalPaths: { terms: "/terms", privacy: "/privacy" },
      markets: { ...DEFAULT_MARKETS, ...((site.markets_json as any) || {}) },
      deals,
      business,
    }
    return (
      <>
        <PostJsonLd post={post} host={host} brandName={site.name} />
        <BlogPostPage host={host} site={site} theme={theme} business={business} formContext={formContext} post={post} />
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
        ...(await buildOptinContext(site)),
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
  if (result.page.enabled === false) notFound()

  let data = mergeThemeIntoRoot(result.page.puck_data, result.theme)
  const postCount = await getPublishedPostCount(result.site.id, result.site.org_id).catch(() => 0)
  if (postCount > 0) data = injectBlogNavLink(data)
  const navPages = await getNavPages(result.site.id).catch(() => [])
  data = injectPageNavLinks(data, navPages)
  data = injectAreaLinks(data, buildAreaLinks(result.site))

  const business = { ...DEFAULT_BUSINESS, ...((result.site.business_json as any) || {}) }
  const deals = await getPublishedDeals(result.site.org_id, 6).catch(() => [])
  const formContext = {
    persona: result.site.persona,
    brandName: result.site.name,
    ...(await buildOptinContext(result.site)),
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
