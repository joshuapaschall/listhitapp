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

export function stateSlug(stateId: string): string {
  return slug(stateName(stateId))            // "GA" -> "georgia", "NC" -> "north-carolina"
}
function placeSlug(place: string): string {
  return slug(place)                          // "Atlanta" -> "atlanta", "Fulton County" -> "fulton-county"
}

// Full path under the persona hub. State -> /persona/state. City/county -> /persona/state/place.
export function marketPath(personaSlug: string, m: ParsedMarket): string {
  if (m.kind === "state") return `/${personaSlug}/${stateSlug(m.stateId)}`
  return `/${personaSlug}/${stateSlug(m.stateId)}/${placeSlug(m.place)}`
}

// Distinct state ids present in the market list — explicit ("GA, USA") OR implied by a city/county ("Atlanta (GA)").
function statesInMarkets(markets: string[]): string[] {
  const ids = new Set<string>()
  for (const e of markets) { const m = parseMarket(e); if (m) ids.add(m.stateId) }
  return Array.from(ids)
}

// City/county markets within a given state.
function citiesInState(markets: string[], stateId: string): ParsedMarket[] {
  const out: ParsedMarket[] = []
  for (const e of markets) {
    const m = parseMarket(e)
    if (m && m.kind !== "state" && m.stateId === stateId) out.push(m)
  }
  return out
}

// Synthesize a state ParsedMarket from an id (for implied state pages).
function stateMarket(stateId: string): ParsedMarket {
  return { kind: "state", label: `${stateId}, USA`, place: "", stateId }
}

export interface LocationMatch {
  persona: SitePersona
  personaSlug: string
  market: ParsedMarket
}

function siteMarkets(site: any): { scope: string; markets: string[] } {
  return { scope: "nationwide", markets: [], ...(site?.markets_json || {}) }
}

// The state id when the home page itself targets a state: specific scope whose
// primary (first) market is a state. Otherwise null. Drives the "state as home" pattern.
export function homeStateId(site: any): string | null {
  const markets = siteMarkets(site)
  if (markets.scope !== "specific") return null
  const first = markets.markets?.[0]
  if (!first) return null
  const m = parseMarket(first)
  return m && m.kind === "state" ? m.stateId : null
}

export function resolveLocationPage(site: any, pathSegments: string[]): LocationMatch | null {
  if (!site || !Array.isArray(pathSegments)) return null
  const markets = siteMarkets(site)
  if (!markets.markets || markets.markets.length === 0) return null

  const persona = site.persona as SitePersona
  const personaSlug = PERSONA_URL_SLUG[persona]
  if (!personaSlug || pathSegments[0] !== personaSlug) return null

  // State page: /persona/state  (matches any explicit or implied state)
  if (pathSegments.length === 2) {
    const want = pathSegments[1]
    for (const stateId of statesInMarkets(markets.markets)) {
      if (stateSlug(stateId) === want) {
        return { persona, personaSlug, market: stateMarket(stateId) }
      }
    }
    return null
  }

  // City/county page: /persona/state/place
  if (pathSegments.length === 3) {
    const wantState = pathSegments[1]
    const wantPlace = pathSegments[2]
    for (const entry of markets.markets) {
      const m = parseMarket(entry)
      if (m && m.kind !== "state" && stateSlug(m.stateId) === wantState && placeSlug(m.place) === wantPlace) {
        return { persona, personaSlug, market: m }
      }
    }
    return null
  }

  return null
}

export function locationPaths(site: any): string[] {
  const markets = siteMarkets(site)
  if (!markets.markets || markets.markets.length === 0) return []
  const personaSlug = PERSONA_URL_SLUG[site.persona as SitePersona]
  if (!personaSlug) return []
  const homeState = homeStateId(site)

  const out = new Set<string>()
  // State hubs — excluding the home-state hub (it redirects to home).
  for (const stateId of statesInMarkets(markets.markets)) {
    if (stateId === homeState) continue
    out.add(`/${personaSlug}/${stateSlug(stateId)}`)
  }
  // Nested city/county pages (home-state cities included — they still resolve).
  for (const entry of markets.markets) {
    const m = parseMarket(entry)
    if (m && m.kind !== "state") out.add(marketPath(personaSlug, m))
  }
  return Array.from(out)
}

// Labelled links to each specific-market location page — the "Areas We Serve"
// internal-linking structure. Specific-market sites only; nationwide returns [].
// Accepts the site shape (persona + markets_json); the footer passes
// `{ persona, markets_json: markets }` so the slug/label math has one home.
// current = null/undefined -> HOME (link to states)
// current = state           -> STATE page (link to its cities)
// current = city/county      -> CITY page (link to siblings in the state + the parent state)
export function buildAreaLinks(
  site: any,
  current?: ParsedMarket | null,
): { label: string; href: string }[] {
  const markets = siteMarkets(site)
  if (!markets.markets || markets.markets.length === 0) return []
  const personaSlug = PERSONA_URL_SLUG[site.persona as SitePersona]
  if (!personaSlug) return []
  const homeState = homeStateId(site)

  // CITY/COUNTY page: parent state first (→ home when it's the home-state), then siblings.
  if (current && current.kind !== "state") {
    const parentHref =
      current.stateId === homeState ? "/" : `/${personaSlug}/${stateSlug(current.stateId)}`
    const out: { label: string; href: string }[] = [
      { label: stateName(current.stateId), href: parentHref },
    ]
    for (const m of citiesInState(markets.markets, current.stateId)) {
      if (placeSlug(m.place) === placeSlug(current.place)) continue
      out.push({ label: m.place, href: marketPath(personaSlug, m) })
    }
    return out
  }

  // STATE page: its cities only.
  if (current && current.kind === "state") {
    return citiesInState(markets.markets, current.stateId).map((m) => ({
      label: m.place,
      href: marketPath(personaSlug, m),
    }))
  }

  // HOME (and footer).
  const out: { label: string; href: string }[] = []
  // When the home IS a state, it acts as that state's hub → link straight to its cities.
  if (homeState) {
    for (const m of citiesInState(markets.markets, homeState)) {
      out.push({ label: m.place, href: marketPath(personaSlug, m) })
    }
  }
  // Other states as hubs (and, when there's no home-state, ALL states — PR5 behavior).
  const seen = new Set<string>()
  for (const stateId of statesInMarkets(markets.markets)) {
    if (stateId === homeState) continue
    if (seen.has(stateId)) continue
    seen.add(stateId)
    out.push({ label: stateName(stateId), href: `/${personaSlug}/${stateSlug(stateId)}` })
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

  // Pass 1: exact city match -> nested city path.
  for (const entry of markets.markets) {
    const m = parseMarket(entry)
    if (m && m.kind === "city" && m.place.toLowerCase() === wantCity && m.stateId === wantState) {
      return marketPath(personaSlug, m)
    }
  }
  // Pass 2: state hub fallback (explicit or implied by any market in that state).
  if (wantState && statesInMarkets(markets.markets).includes(wantState)) {
    return `/${personaSlug}/${stateSlug(wantState)}`
  }
  return null
}
