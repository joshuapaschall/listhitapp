import type { SitePersona } from "@/lib/site-builder/types"
import type { ParsedMarket } from "@/lib/site-builder/location-pages"

export interface LocationCopy {
  title: string
  metaDescription: string
  h1: string
  intro: string
  prose: { h2: string; body: string }[]
}

const STATE_NAMES: Record<string, string> = {
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

function stateName(stateId: string): string {
  return STATE_NAMES[stateId] || stateId
}

// The {City} value for a location page: city/county → the place; state → the
// full state name (e.g. "Georgia", not "GA").
export function marketCityLabel(m: ParsedMarket): string {
  return m.kind === "state" ? stateName(m.stateId) : m.place
}

// "Atlanta, GA" for city/county; full state name for a state-level page.
function placeLabelOf(m: ParsedMarket): string {
  if (m.kind === "state") return stateName(m.stateId)
  return `${m.place}, ${m.stateId}`
}

// Short locality token used inside prose ("buyers in Atlanta", "across Georgia").
function placeShort(m: ParsedMarket): string {
  if (m.kind === "state") return stateName(m.stateId)
  return m.place
}

interface PersonaCopy {
  // Front-loaded keyword phrase used in title/h1.
  phrase: string
  metaDescription: (place: string, brand: string) => string
  intro: (m: ParsedMarket, brand: string) => string
  prose: (m: ParsedMarket, brand: string) => { h2: string; body: string }[]
}

const PERSONA_COPY: Record<SitePersona, PersonaCopy> = {
  cash: {
    phrase: "Investment Properties",
    metaDescription: (place, brand) =>
      `Browse discounted investment properties in ${place} and get new off-market deals first. Join ${brand}'s cash buyers list — free, by text and email.`,
    intro: (m, brand) => {
      const place = placeShort(m)
      return `Looking for investment properties in ${place}? ${brand} sends cash buyers deeply discounted, off-market deals across ${place}, ${stateName(m.stateId)} before they ever hit the open market. Tell us your buy box and we'll match you to the right properties — fast.`
    },
    prose: (m, brand) => {
      const place = placeShort(m)
      const st = stateName(m.stateId)
      return [
        {
          h2: `Off-market investment properties in ${place}`,
          body: `The best investment properties in ${place} rarely make it to a public listing site. They move quietly between investors and acquisition teams long before a sign ever goes in the yard. ${brand} works ${place}, ${st} every day to source these off-market deals — distressed homes, value-add rentals, fix-and-flips, and turnkey cash-flow properties priced for investors who move quickly. When you join our ${place} buyers list, you get first look at each deal with the numbers that matter: asking price, estimated repairs, comparable sales, and projected returns. No retail bidding wars, no chasing overpriced listings — just real ${place} inventory matched to what you're actually trying to buy.`,
        },
        {
          h2: `Why cash buyers choose ${brand} in ${st}`,
          body: `Speed and certainty win deals in ${place}. Sellers of distressed and off-market property in ${st} care less about top dollar and more about a clean, fast close — which is exactly where cash buyers have the edge. ${brand} prioritizes buyers who can perform, so the moment a new ${place} property is locked up, it goes straight to our list. Set your criteria once — target price range, property type, neighborhoods, and condition — and we'll send only the ${place} deals that fit. It's free to join, there's never any obligation on a given property, and you can pass on anything that isn't right. If you're serious about building a portfolio in ${place}, ${st}, getting on the list is the fastest way to see deal flow first.`,
        },
      ]
    },
  },
  investor: {
    phrase: "Investment Deals",
    metaDescription: (place, brand) =>
      `Get vetted investment deals in ${place} sent straight to you. Join ${brand}'s investor network — off-market opportunities, free by text and email.`,
    intro: (m, brand) => {
      const place = placeShort(m)
      return `Want vetted investment deals in ${place}? ${brand} delivers off-market opportunities across ${place}, ${stateName(m.stateId)} to a private network of serious investors. Share your buy box and start seeing deals that match — before the wider market does.`
    },
    prose: (m, brand) => {
      const place = placeShort(m)
      const st = stateName(m.stateId)
      return [
        {
          h2: `Vetted investment deals in ${place}`,
          body: `${brand} curates investment deals in ${place} so you spend time underwriting, not hunting. Every ${place}, ${st} opportunity we send is screened for the basics that make or break a deal — realistic acquisition price, repair scope, rent or resale comps, and exit potential. Whether you're after buy-and-hold rentals, BRRRR candidates, or quick-turn flips, our ${place} deal flow is built around what active investors actually want. You'll see the address, the photos, and the figures up front, so you can make a fast yes-or-no call instead of digging through retail listings that never pencil out.`,
        },
        {
          h2: `Build your ${st} pipeline with ${brand}`,
          body: `Consistent returns come from consistent deal flow, and that's what a network is for. By joining ${brand}'s investor list for ${place}, you tap a steady pipeline of ${st} opportunities matched to your strategy. Tell us your target markets, price bands, and property types, and we'll route the right ${place} deals to you the moment they're available. There's no cost to join and no obligation on any single deal — pass on what doesn't fit and move on the ones that do. Investors who see ${place} inventory first simply get more chances to win, and that early access is the whole point of being on the list.`,
        },
      ]
    },
  },
  rto: {
    phrase: "Rent-to-Own Homes",
    metaDescription: (place, brand) =>
      `Find rent-to-own homes in ${place} with flexible terms. Join ${brand}'s buyer list to get new lease-to-own properties first — free to join.`,
    intro: (m, brand) => {
      const place = placeShort(m)
      return `Searching for rent-to-own homes in ${place}? ${brand} helps buyers in ${place}, ${stateName(m.stateId)} find lease-to-own properties with flexible terms — a path to ownership even if you're still working toward traditional financing. Join the list and we'll send matching homes as they come available.`
    },
    prose: (m, brand) => {
      const place = placeShort(m)
      const st = stateName(m.stateId)
      return [
        {
          h2: `Rent-to-own homes in ${place}`,
          body: `Rent-to-own gives ${place} buyers a way into a home now while building toward a mortgage later. With a lease-to-own arrangement, you move into the property, rent it on agreed terms, and lock in the option to purchase down the road — often with a portion of your payments working toward the buy. ${brand} sources rent-to-own homes throughout ${place}, ${st} and matches them to buyers based on budget, location, and timeline. Instead of scrolling endless listings that require perfect credit and a big down payment today, you'll see ${place} properties with terms designed for real-world buyers.`,
        },
        {
          h2: `How ${brand} helps ${st} buyers own`,
          body: `The hardest part of rent-to-own is finding legitimate properties with fair terms — and that's exactly what ${brand} does for ${place}. Tell us what you're looking for: the areas of ${st} you want, your monthly budget, bedrooms and baths, and when you'd like to move. We'll send ${place} rent-to-own homes that fit and walk you through how each option works. It's free to join the list, there's no obligation, and you can take your time choosing the right home. If a traditional mortgage isn't an option yet, a rent-to-own home in ${place} can be the bridge that gets you there.`,
        },
      ]
    },
  },
  owner: {
    phrase: "Owner-Financed Homes",
    metaDescription: (place, brand) =>
      `Browse owner-financed homes in ${place} — buy directly from the seller, no bank required. Join ${brand}'s buyer list free to see new deals first.`,
    intro: (m, brand) => {
      const place = placeShort(m)
      return `Looking for owner-financed homes in ${place}? ${brand} connects buyers in ${place}, ${stateName(m.stateId)} with seller-financed properties — purchase directly from the owner without a traditional bank loan. Join the list to get matching homes as they hit the market.`
    },
    prose: (m, brand) => {
      const place = placeShort(m)
      const st = stateName(m.stateId)
      return [
        {
          h2: `Owner-financed homes in ${place}`,
          body: `Owner financing lets you buy a home in ${place} directly from the seller, who acts as the lender instead of a bank. You agree on the price, down payment, interest rate, and term up front, then make payments to the owner over time. For many ${place}, ${st} buyers — the self-employed, newer credit profiles, or anyone who wants a faster, simpler path — seller financing opens doors that conventional lending keeps closed. ${brand} sources owner-financed homes across ${place} and matches them to buyers by budget and location, so you see realistic options instead of listings that demand bank approval.`,
        },
        {
          h2: `Buy on seller terms with ${brand}`,
          body: `The key to owner financing is finding sellers genuinely open to it on fair terms, and ${brand} does that legwork in ${place}. Share your buy box — the parts of ${st} you want, your down-payment range, monthly comfort level, and the type of home — and we'll send ${place} owner-financed properties that match. We'll explain how each deal is structured so you understand the numbers before you commit. Joining is free with no obligation, and you choose only the home that's right for you. If you're ready to own in ${place} without waiting on a bank, getting on the list is the place to start.`,
        },
      ]
    },
  },
  creative: {
    phrase: "Creative-Finance Homes",
    metaDescription: (place, brand) =>
      `Find creative-finance homes in ${place} — subject-to, lease options, and seller terms. Join ${brand}'s buyer list free for new deals first.`,
    intro: (m, brand) => {
      const place = placeShort(m)
      return `Interested in creative-finance homes in ${place}? ${brand} matches buyers in ${place}, ${stateName(m.stateId)} with subject-to, lease-option, and seller-financed deals — flexible structures that don't depend on a conventional mortgage. Join the list to see matching properties first.`
    },
    prose: (m, brand) => {
      const place = placeShort(m)
      const st = stateName(m.stateId)
      return [
        {
          h2: `Creative-finance homes in ${place}`,
          body: `Creative financing is a set of tools for buying ${place} homes outside the standard bank-loan path — subject-to existing mortgages, lease options, seller carrybacks, and hybrid structures. Each one lets a ${place}, ${st} buyer and seller solve for what matters most to them: low money down, flexible terms, or speed. ${brand} sources creative-finance opportunities throughout ${place} and matches them to buyers who understand these structures. You'll see how each deal is put together — the entry cost, the monthly numbers, and the path to long-term ownership — so you can evaluate ${place} properties on real terms.`,
        },
        {
          h2: `Flexible deal structures with ${brand}`,
          body: `The advantage of creative finance is flexibility, and the challenge is finding the right deal with terms that work — which is where ${brand} comes in for ${place}. Tell us your goals across ${st}: how much you can put down, the monthly payment you're targeting, and the kind of property you want. We'll route ${place} subject-to, lease-option, and seller-financed deals that fit and walk you through the structure of each. It's free to join, with no obligation on any single property. For buyers who want options beyond a traditional mortgage, creative-finance homes in ${place} can be the smartest way in.`,
        },
      ]
    },
  },
  land: {
    phrase: "Land for Sale",
    metaDescription: (place, brand) =>
      `Browse land and lots for sale in ${place} — off-market parcels priced to move. Join ${brand}'s buyer list free to get new listings first.`,
    intro: (m, brand) => {
      const place = placeShort(m)
      return `Looking for land for sale in ${place}? ${brand} sources lots and acreage across ${place}, ${stateName(m.stateId)} — including off-market parcels you won't find on the major listing sites. Tell us what you're after and we'll send matching land as it becomes available.`
    },
    prose: (m, brand) => {
      const place = placeShort(m)
      const st = stateName(m.stateId)
      return [
        {
          h2: `Land and lots for sale in ${place}`,
          body: `Whether you're planning to build, hold, or develop, buying land in ${place} starts with finding the right parcel at the right price. ${brand} sources land for sale throughout ${place}, ${st} — residential lots, acreage, and off-market parcels that often never reach a public listing site. We match each piece to buyers based on use, size, and budget, so you see ${place} land that actually fits your plan instead of sifting through overpriced or unbuildable listings. From infill lots to larger tracts, our ${place} inventory is built for buyers who know what they want to do with the dirt.`,
        },
        {
          h2: `Find your parcel in ${st} with ${brand}`,
          body: `Good land deals in ${place} move quickly, especially the off-market ones. By joining ${brand}'s buyer list, you get first look at new ${st} parcels matched to your criteria — county or city, acreage range, zoning or intended use, and price. Tell us once what you're searching for and we'll send only the ${place} land that fits. Joining is free and there's no obligation on any listing — pass on what doesn't work and move on what does. If you're serious about buying land in ${place}, ${st}, early access to new parcels is the difference between landing the right lot and watching it sell to someone else.`,
        },
      ]
    },
  },
  commercial: {
    phrase: "Commercial Properties",
    metaDescription: (place, brand) =>
      `Find commercial properties for sale in ${place} — off-market retail, office, multifamily, and more. Join ${brand}'s buyer list free for new deals first.`,
    intro: (m, brand) => {
      const place = placeShort(m)
      return `Searching for commercial properties in ${place}? ${brand} sources off-market commercial real estate across ${place}, ${stateName(m.stateId)} — retail, office, multifamily, and mixed-use — and matches it to qualified buyers. Join the list to see deals before they reach the broader market.`
    },
    prose: (m, brand) => {
      const place = placeShort(m)
      const st = stateName(m.stateId)
      return [
        {
          h2: `Commercial properties for sale in ${place}`,
          body: `Commercial real estate in ${place} rewards buyers with access and speed. ${brand} sources commercial properties throughout ${place}, ${st} — retail strips, office buildings, multifamily, industrial, and mixed-use — including off-market assets that trade privately between owners and investors. Each ${place} opportunity comes with the figures that drive a commercial decision: asking price, in-place income, expenses, and upside. Instead of competing on fully marketed listings, you get a direct line to ${place} inventory matched to your asset class and return targets.`,
        },
        {
          h2: `Grow your ${st} holdings with ${brand}`,
          body: `Commercial deal flow is relationship-driven, and ${brand}'s network gives you a seat at the table in ${place}. Tell us your buy box across ${st}: asset types, price range, target returns, and the submarkets you want. We'll send the ${place} commercial deals that fit, the moment they're available, so you can underwrite and act while the opportunity is fresh. It's free to join the list with no obligation on any single property. For investors and owner-operators building a portfolio in ${place}, ${st}, seeing commercial opportunities first is the edge that closes deals.`,
        },
      ]
    },
  },
  agent: {
    phrase: "Off-Market Homes",
    metaDescription: (place, brand) =>
      `Get off-market and coming-soon homes in ${place} before they hit the MLS. Join ${brand}'s VIP buyer list — free, by text and email.`,
    intro: (m, brand) => {
      const place = placeShort(m)
      return `Want first access to off-market homes in ${place}? ${brand} is a local agent in ${place}, ${stateName(m.stateId)} who sends VIP buyers coming-soon and pocket listings before they hit the MLS. Join the list, tell us what you want, and move on the right home before the rest of the market even sees it.`
    },
    prose: (m, brand) => {
      const place = placeShort(m)
      const st = stateName(m.stateId)
      return [
        {
          h2: `Off-market and coming-soon homes in ${place}`,
          body: `Some of the best homes in ${place} sell before they're ever publicly listed. Coming-soon properties, pocket listings, and quiet sales move through agents and their networks first — and by the time a home appears on the MLS, the most prepared buyers have often already toured it. ${brand} is a local ${place}, ${st} agent who gives VIP buyers a head start on exactly these opportunities. Joining the list means you hear about new ${place} homes early, with real details and photos, so you're positioned to act while everyone else is still waiting for the listing to go live.`,
        },
        {
          h2: `How the ${brand} VIP buyer list works`,
          body: `It's simple: tell us what you want, get matched, and move first. Share your criteria for ${place} — neighborhoods across ${st}, price range, bedrooms and baths, and your timeline — and ${brand} will send coming-soon and off-market homes that fit as they come up. Because ${brand} is a local agent, you're getting listings early, straight from the source, not a scraped feed. There's no cost to join and no obligation — you decide which ${place} homes are worth a closer look. In a competitive market, early access wins, and the VIP list is how serious ${place} buyers see the right homes before anyone else.`,
        },
      ]
    },
  },
}

export function locationCopy(persona: SitePersona, m: ParsedMarket, brandName: string): LocationCopy {
  const cfg = PERSONA_COPY[persona] || PERSONA_COPY.cash
  const placeLabel = placeLabelOf(m)
  const brand = brandName || "our team"
  const title = `${cfg.phrase} in ${placeLabel}`
  return {
    title,
    h1: title,
    metaDescription: cfg.metaDescription(placeLabel, brand),
    intro: cfg.intro(m, brand),
    prose: cfg.prose(m, brand),
  }
}
