import type { PersonaContent, SitePersona } from "../types"

// High-converting, direct-response default copy per persona. Headlines lead
// with the offer; features are benefit-driven; CTAs are explicit.
export const PERSONAS: Record<SitePersona, PersonaContent> = {
  cash: {
    eyebrow: "Trusted local cash buyer",
    headline: "Sell your house fast — for cash, as-is",
    subhead: "Skip the agents, repairs, and showings. Get a fair cash offer in 24 hours and close on your timeline.",
    stat: "500+ homes bought for cash",
    formTitle: "Get your cash offer",
    formSubtitle: "Takes 60 seconds — no obligation.",
    ctaLabel: "Get my cash offer",
    bannerCta: "Get a cash offer today",
    features: [
      { icon: "⚡", title: "Close in days, not months", body: "Pick your closing date — we can fund in as little as 7 days." },
      { icon: "💵", title: "Fair, all-cash offer", body: "No lowballs and no financing fall-through. A real number you can count on." },
      { icon: "🛠️", title: "Sell completely as-is", body: "No repairs, no cleaning, no staging. We buy it exactly how it sits." },
    ],
  },
  land: {
    eyebrow: "Nationwide land buyer",
    headline: "Sell your vacant land — fast and hassle-free",
    subhead: "Stop paying taxes on land you'll never use. Get a no-obligation cash offer for your parcel this week.",
    stat: "2,000+ acres purchased",
    formTitle: "Get your land offer",
    formSubtitle: "Just need your parcel info.",
    ctaLabel: "Get my land offer",
    bannerCta: "Sell your land now",
    features: [
      { icon: "🗺️", title: "Any parcel, any state", body: "Rural, infill, landlocked — we make offers on land others won't touch." },
      { icon: "🧾", title: "We cover the costs", body: "No closing fees, no commissions, no surprise deductions at the table." },
      { icon: "⏱️", title: "Close remotely", body: "Sign online and get paid. You never have to set foot on the property." },
    ],
  },
  owner: {
    eyebrow: "Flexible owner financing",
    headline: "Own a home — no bank required",
    subhead: "Bad credit? Self-employed? Our owner-financed homes put you in the door with simple, flexible terms.",
    stat: "Hundreds of families approved",
    formTitle: "Check your eligibility",
    formSubtitle: "Soft check — won't affect your credit.",
    ctaLabel: "See if I qualify",
    bannerCta: "Get pre-qualified",
    features: [
      { icon: "🏠", title: "Skip the bank", body: "Finance directly through us — no traditional mortgage approval needed." },
      { icon: "📝", title: "Flexible terms", body: "Down payments and monthly plans built around your real budget." },
      { icon: "✅", title: "Credit-friendly", body: "Past credit issues don't disqualify you. We look at the whole picture." },
    ],
  },
  rto: {
    eyebrow: "Rent-to-own homes",
    headline: "Rent now, own later — start building equity today",
    subhead: "Move into the home you want while you work toward ownership. A clear path from renter to homeowner.",
    stat: "Move-in ready homes available",
    formTitle: "Find your rent-to-own home",
    formSubtitle: "See homes you can qualify for.",
    ctaLabel: "Browse homes",
    bannerCta: "Start rent-to-own",
    features: [
      { icon: "🔑", title: "Move in fast", body: "Get into a quality home now while you prepare to buy it outright." },
      { icon: "📈", title: "Build toward ownership", body: "A portion of every payment moves you closer to owning the home." },
      { icon: "🤝", title: "Clear, fair terms", body: "Locked-in purchase price and a simple agreement — no fine-print games." },
    ],
  },
  commercial: {
    eyebrow: "Commercial property buyer",
    headline: "Sell your commercial property — fast and discreet",
    subhead: "Retail, office, multifamily, or industrial. Get a confidential cash offer and close without the broker runaround.",
    stat: "$50M+ in commercial deals closed",
    formTitle: "Request a confidential offer",
    formSubtitle: "Your details stay private.",
    ctaLabel: "Get my offer",
    bannerCta: "Request an offer",
    features: [
      { icon: "🏢", title: "All asset classes", body: "Retail, office, industrial, and multifamily — occupied or vacant." },
      { icon: "🔒", title: "Fully confidential", body: "No public listing, no signs, no disruption to your tenants or staff." },
      { icon: "💼", title: "Close on your terms", body: "Flexible timelines and structures, including sale-leaseback options." },
    ],
  },
  agentinv: {
    eyebrow: "For real estate investors",
    headline: "Off-market deals delivered to your inbox",
    subhead: "Get first look at discounted, cash-flowing properties before they ever hit the MLS. Built for serious buyers.",
    stat: "New deals added weekly",
    formTitle: "Join the buyers list",
    formSubtitle: "Tell us your buy box.",
    ctaLabel: "Get deal alerts",
    bannerCta: "Join the buyers list",
    features: [
      { icon: "📬", title: "Exclusive off-market", body: "Wholesale and distressed deals you won't find on the open market." },
      { icon: "🎯", title: "Matched to your criteria", body: "Set your markets, price, and returns — only get deals that fit." },
      { icon: "🚀", title: "Move first", body: "Be the first call when a deal hits. Speed wins in this market." },
    ],
  },
  agentbuy: {
    eyebrow: "Your local real estate expert",
    headline: "Find the right home with an agent who has your back",
    subhead: "From first showing to closing day, get expert guidance, sharp negotiation, and a smooth path to your new home.",
    stat: "Hundreds of happy buyers",
    formTitle: "Start your home search",
    formSubtitle: "Tell us what you're looking for.",
    ctaLabel: "Connect with an agent",
    bannerCta: "Start your search",
    features: [
      { icon: "🔎", title: "Homes before they're gone", body: "Get matched to listings — and off-market opportunities — that fit you." },
      { icon: "🤝", title: "Expert negotiation", body: "We fight for the best price and terms so you keep more in your pocket." },
      { icon: "🧭", title: "Guidance start to finish", body: "Financing, inspections, closing — we handle the details with you." },
    ],
  },
}

export function getPersona(id: SitePersona): PersonaContent {
  return PERSONAS[id]
}
