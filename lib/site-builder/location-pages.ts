import type { SitePersona } from "@/lib/site-builder/types"

// Pure, server-safe helpers for programmatic location landing pages. No React,
// no hooks, no DB — slugs are computed deterministically from the canonical
// market strings stored in sites.markets_json (see lib/location-utils.ts).

export type ParsedMarket = {
  kind: "city" | "county" | "state"
  label: string
  place: string
  stateId: string
}

// Canonical market strings come in exactly three shapes:
//   city:   "Atlanta (GA)"
//   county: "Fulton County (GA)"
//   state:  "GA, USA"
export function parseMarket(market: string): ParsedMarket | null {
  if (!market) return null
  const trimmed = market.trim()

  const paren = trimmed.match(/^(.*)\s+\(([A-Z]{2})\)$/)
  if (paren) {
    const place = paren[1].trim()
    const stateId = paren[2]
    const kind = /\bCounty$/i.test(place) ? "county" : "city"
    return { kind, label: trimmed, place, stateId }
  }

  const state = trimmed.match(/^([A-Z]{2}),\s*USA$/)
  if (state) {
    return { kind: "state", label: trimmed, place: "", stateId: state[1] }
  }

  return null
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export const PERSONA_URL_SLUG: Record<SitePersona, string> = {
  cash: "investment-properties",
  investor: "investment-deals",
  rto: "rent-to-own-homes",
  owner: "owner-financed-homes",
  creative: "creative-finance-homes",
  land: "land-for-sale",
  commercial: "commercial-properties",
  agent: "off-market-homes",
}

export function marketToSlug(m: ParsedMarket): string {
  if (m.kind === "state") return m.stateId.toLowerCase()
  return slug(`${m.place}-${m.stateId}`)
}

export interface LocationMatch {
  persona: SitePersona
  personaSlug: string
  market: ParsedMarket
}

function siteMarkets(site: any): { scope: string; markets: string[] } {
  return { scope: "nationwide", markets: [], ...(site?.markets_json || {}) }
}

export function resolveLocationPage(site: any, pathSegments: string[]): LocationMatch | null {
  if (!site || !Array.isArray(pathSegments) || pathSegments.length !== 2) return null
  const markets = siteMarkets(site)
  if (markets.scope !== "specific") return null

  const persona = site.persona as SitePersona
  const personaSlug = PERSONA_URL_SLUG[persona]
  if (!personaSlug || pathSegments[0] !== personaSlug) return null

  for (const entry of markets.markets) {
    const parsed = parseMarket(entry)
    if (parsed && marketToSlug(parsed) === pathSegments[1]) {
      return { persona, personaSlug, market: parsed }
    }
  }
  return null
}

export function locationPaths(site: any): string[] {
  const markets = siteMarkets(site)
  if (markets.scope !== "specific") return []
  const personaSlug = PERSONA_URL_SLUG[site.persona as SitePersona]
  if (!personaSlug) return []

  const out = new Set<string>()
  for (const entry of markets.markets) {
    const parsed = parseMarket(entry)
    if (parsed) out.add(`/${personaSlug}/${marketToSlug(parsed)}`)
  }
  return Array.from(out)
}

// Deep-links a property's breadcrumb to its city's (or state's) landing page.
export function locationHrefForDeal(site: any, city: string | null, state: string | null): string | null {
  const markets = siteMarkets(site)
  if (markets.scope !== "specific") return null
  const personaSlug = PERSONA_URL_SLUG[site.persona as SitePersona]
  if (!personaSlug) return null

  const wantCity = (city || "").toLowerCase()
  const wantState = state || ""

  // Pass 1: exact city match.
  for (const entry of markets.markets) {
    const parsed = parseMarket(entry)
    if (parsed && parsed.kind === "city" && parsed.place.toLowerCase() === wantCity && parsed.stateId === wantState) {
      return `/${personaSlug}/${marketToSlug(parsed)}`
    }
  }
  // Pass 2: state-level fallback.
  for (const entry of markets.markets) {
    const parsed = parseMarket(entry)
    if (parsed && parsed.kind === "state" && parsed.stateId === wantState) {
      return `/${personaSlug}/${marketToSlug(parsed)}`
    }
  }
  return null
}
