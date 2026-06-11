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

// Single source of truth for state-id → full state name (imported by
// location-content.ts and interpolate.ts via the display helpers below).
export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "Washington, D.C.",
}

export function stateName(stateId: string): string {
  return STATE_NAMES[stateId] || stateId
}

// For {City} interpolation: city/county -> place; state -> full state name.
// "Atlanta (GA)" -> "Atlanta", "Fulton County (GA)" -> "Fulton County", "GA, USA" -> "Georgia"
export function cityLabelForMarket(entry: string): string {
  const m = parseMarket(entry)
  if (!m) return entry
  return m.kind === "state" ? stateName(m.stateId) : m.place
}

// For chips / "Serving" lists: city/county -> "Place, ST"; state -> full state name.
// "Atlanta (GA)" -> "Atlanta, GA", "GA, USA" -> "Georgia"
export function formatMarketLabel(entry: string): string {
  const m = parseMarket(entry)
  if (!m) return entry
  if (m.kind === "state") return stateName(m.stateId)
  return `${m.place}, ${m.stateId}`
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
  if (m.kind === "state") return slug(stateName(m.stateId))   // "GA" -> "georgia", "NC" -> "north-carolina"
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
  if (!markets.markets || markets.markets.length === 0) return null

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
  if (!markets.markets || markets.markets.length === 0) return []
  const personaSlug = PERSONA_URL_SLUG[site.persona as SitePersona]
  if (!personaSlug) return []

  const out = new Set<string>()
  for (const entry of markets.markets) {
    const parsed = parseMarket(entry)
    if (parsed) out.add(`/${personaSlug}/${marketToSlug(parsed)}`)
  }
  return Array.from(out)
}

// Labelled links to each specific-market location page — the "Areas We Serve"
// internal-linking structure. Specific-market sites only; nationwide returns [].
// Accepts the site shape (persona + markets_json); the footer passes
// `{ persona, markets_json: markets }` so the slug/label math has one home.
export function buildAreaLinks(site: any): { label: string; href: string }[] {
  const markets = siteMarkets(site)
  if (!markets.markets || markets.markets.length === 0) return []
  const personaSlug = PERSONA_URL_SLUG[site.persona as SitePersona]
  if (!personaSlug) return []

  const out: { label: string; href: string }[] = []
  const seen = new Set<string>()
  for (const entry of markets.markets) {
    const parsed = parseMarket(entry)
    if (!parsed) continue
    const href = `/${personaSlug}/${marketToSlug(parsed)}`
    if (seen.has(href)) continue
    seen.add(href)
    const label = parsed.kind === "state" ? stateName(parsed.stateId) : parsed.place
    out.push({ label, href })
  }
  return out
}

// Deep-links a property's breadcrumb to its city's (or state's) landing page.
export function locationHrefForDeal(site: any, city: string | null, state: string | null): string | null {
  const markets = siteMarkets(site)
  if (!markets.markets || markets.markets.length === 0) return null
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
