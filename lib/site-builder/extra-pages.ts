import { PERSONAS } from "./templates/personas"
import type { SitePersona } from "./types"

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}
function pick(home: any, type: string) {
  const b = (home?.content || []).find((x: any) => x?.type === type)
  return b ? clone(b) : null
}
// Sub-pages can't use home-only "#anchor" links; make them root-relative so
// they navigate home then scroll.
function rootRelativeAnchors(nav: any) {
  if (nav?.props?.links) {
    nav.props.links = nav.props.links.map((l: any) =>
      l?.href && l.href.startsWith("#") ? { ...l, href: "/" + l.href } : l,
    )
  }
  return nav
}
function reid(block: any, suffix: string) {
  if (block?.props?.id) block.props.id = `${block.props.id}${suffix}`
  return block
}
function conversionBand(suffix: string) {
  return {
    type: "ConversionBand",
    props: {
      id: `join-${suffix}`,
      heading: "Ready to see the deals?",
      body: "Join the buyers list and get new off-market deals by text and email — free, no contract.",
      formTitle: "Get deals sent to you",
      ctaLabel: "Send me deals",
    },
  }
}

export function buildAboutPage(home: any, persona: SitePersona) {
  const c = PERSONAS[persona]
  const nav = reid(rootRelativeAnchors(pick(home, "Nav")), "-about")
  const footer = reid(pick(home, "Footer"), "-about")
  const about = {
    type: "AboutStory",
    props: {
      id: "AboutStory-about",
      headline: c.about.headline,
      body: c.about.body,
      trust: (c.about.trust || []).map((t) => ({ text: t })),
      stats: [],
    },
  }
  return { root: clone(home?.root || {}), content: [nav, about, conversionBand("about"), footer].filter(Boolean) }
}

export function buildFaqPage(home: any, persona: SitePersona) {
  const c = PERSONAS[persona]
  const nav = reid(rootRelativeAnchors(pick(home, "Nav")), "-faq")
  const footer = reid(pick(home, "Footer"), "-faq")
  const faq = { type: "Faq", props: { id: "Faq-page", heading: "Questions & answers", items: c.faqs } }
  return { root: clone(home?.root || {}), content: [nav, faq, conversionBand("faq"), footer].filter(Boolean) }
}

// Build a ProseSection from the persona's first prose section (guarded).
function proseFrom(c: (typeof PERSONAS)[SitePersona], suffix: string) {
  const p = c.prose?.[0]
  if (!p) return null
  return {
    type: "ProseSection",
    props: {
      id: `ProseSection-${suffix}`,
      eyebrow: p.eyebrow,
      heading: p.heading,
      bodyHtml: p.bodyHtml,
      pullQuote: p.pullQuote ?? "",
      ctaText: "",
      ctaHref: "",
    },
  }
}

export function buildHowItWorksPage(home: any, persona: SitePersona) {
  const c = PERSONAS[persona]
  const nav = reid(rootRelativeAnchors(pick(home, "Nav")), "-howitworks")
  const footer = reid(pick(home, "Footer"), "-howitworks")
  const prose = proseFrom(c, "howitworks")
  const how = {
    type: "HowItWorks",
    props: { id: "HowItWorks-howitworks", heading: "How it works", steps: c.howItWorks },
  }
  const types = {
    type: "TypesGrid",
    props: { id: "TypesGrid-howitworks", heading: "What we send", intro: "", items: c.types },
  }
  return { root: clone(home?.root || {}), content: [nav, prose, how, types, conversionBand("howitworks"), footer].filter(Boolean) }
}

export function buildReviewsPage(home: any) {
  const nav = reid(rootRelativeAnchors(pick(home, "Nav")), "-reviews")
  const footer = reid(pick(home, "Footer"), "-reviews")
  const reviews = {
    type: "ReviewsWall",
    props: {
      id: "ReviewsWall-reviews",
      heading: "What buyers say",
      emptyText: "No reviews yet — they'll appear here as buyers close deals from the list.",
      reviews: [],
    },
  }
  return { root: clone(home?.root || {}), content: [nav, reviews, conversionBand("reviews"), footer].filter(Boolean) }
}

export function buildBuyersListPage(home: any, persona: SitePersona) {
  const c = PERSONAS[persona]
  const nav = reid(rootRelativeAnchors(pick(home, "Nav")), "-buyers")
  const cta = reid(pick(home, "CtaBand"), "-buyers")
  const footer = reid(pick(home, "Footer"), "-buyers")
  const prose = proseFrom(c, "buyers")
  const types = {
    type: "TypesGrid",
    props: { id: "TypesGrid-buyers", heading: "What we send", intro: "", items: c.types },
  }
  const contact = {
    type: "ContactPanel",
    props: {
      id: "join",
      heading: "Join the buyers list",
      phone: "",
      email: "",
      hours: "",
      serviceArea: "",
      note: "Free to join. New off-market deals by text and email — reply STOP anytime.",
    },
  }
  return { root: clone(home?.root || {}), content: [nav, prose, types, contact, cta, footer].filter(Boolean) }
}

export function buildContactPage(
  home: any,
  opts: { phone?: string; email?: string; hours?: string; serviceArea?: string },
) {
  const nav = reid(rootRelativeAnchors(pick(home, "Nav")), "-contact")
  const footer = reid(pick(home, "Footer"), "-contact")
  const contact = {
    type: "ContactPanel",
    props: {
      id: "join",
      heading: "Contact {Brand}",
      intro:
        "Have a question about a deal or about joining the list? Reach us directly, or drop your details and we'll send new off-market deals straight to you.",
      phone: opts.phone || "",
      email: opts.email || "",
      hours: opts.hours || "",
      serviceArea: opts.serviceArea || "",
      note: "Free to join. New off-market deals by text and email — reply STOP anytime.",
    },
  }
  return { root: clone(home?.root || {}), content: [nav, contact, footer].filter(Boolean) }
}

// Canonical list of auto-seeded sub-pages — single source of truth for both
// seeders (SiteService.create + scripts/backfill-sites.ts) and the onboarding
// wizard's page toggles. /contact is a compliance page (LEGAL_PATHS) and is not
// listed here. Reviews defaults off — a brand-new site has no reviews yet.
export const EXTRA_PAGES: {
  path: string
  title: string
  navLabel: string
  sortOrder: number
  enabledByDefault: boolean
  build: (home: any, persona: SitePersona) => any
}[] = [
  { path: "/about",        title: "About",               navLabel: "About",         sortOrder: 10, enabledByDefault: true,  build: buildAboutPage },
  { path: "/faq",          title: "Questions & answers", navLabel: "FAQ",           sortOrder: 20, enabledByDefault: true,  build: buildFaqPage },
  { path: "/how-it-works", title: "How it works",        navLabel: "How it works",  sortOrder: 30, enabledByDefault: true,  build: buildHowItWorksPage },
  { path: "/reviews",      title: "Reviews",             navLabel: "Reviews",       sortOrder: 40, enabledByDefault: false, build: buildReviewsPage },
  { path: "/buyers",       title: "Buyers list",         navLabel: "Buyers list",   sortOrder: 50, enabledByDefault: true,  build: buildBuyersListPage },
]
