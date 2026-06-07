import type { PersonaContent, SitePersona } from "../types"

// Buyer-acquisition / list-building copy. The site owner is a
// wholesaler/investor/agent building a buyer list; the visitor is the buyer.
export const PERSONAS: Record<SitePersona, PersonaContent> = {
  cash: {
    label: "Cash buyers",
    eyebrow: "Off-market cash deals",
    headline: "Get our best off-market deals before anyone else.",
    subhead:
      "Join our cash buyers list and get new wholesale and off-market properties — 30 to 50% under retail — the moment we lock them up. By text and email. Free to join.",
    stat: "1,200+ active buyers on the list",
    formTitle: "Get deals sent to you",
    formSubtitle: "New off-market properties, by text and email.",
    ctaLabel: "Send me deals",
    bannerCta: "Join the buyers list",
    features: [
      { icon: "🏠", title: "Off-market access", body: "Deals direct from distressed sellers, probate, and tax-delinquent owners — never on the MLS." },
      { icon: "⚡", title: "You move first", body: "Buyers on the list get every new deal by text the moment we lock it up." },
      { icon: "💵", title: "Free to join", body: "No fees, no contracts. We make money on the deals, not on the list." },
    ],
  },
  investor: {
    label: "Investor buyers",
    eyebrow: "Vetted investment deals",
    headline: "Funded deals, straight to your inbox.",
    subhead:
      "We send vetted flip and rental opportunities to our private investor network before they ever hit the market — with the numbers already run.",
    stat: "$42M+ in deals moved",
    formTitle: "Join the investor list",
    formSubtitle: "Deal alerts by text and email.",
    ctaLabel: "Get the deals",
    bannerCta: "Join the investor list",
    features: [
      { icon: "📊", title: "Numbers already run", body: "Every deal comes with the spread, ARV, and rehab estimate so you can decide fast." },
      { icon: "🎯", title: "First look", body: "Our network sees opportunities before they reach the broader market." },
      { icon: "📈", title: "Built-in equity", body: "We've already negotiated the discount — you close with equity in place." },
    ],
  },
  rto: {
    label: "Rent-to-own buyers",
    eyebrow: "Rent-to-own homes",
    headline: "Own the home you're renting — no bank needed.",
    subhead:
      "Get matched with rent-to-own homes in your area and start building toward ownership today. Less-than-perfect credit is okay.",
    stat: "Move-in ready homes available now",
    formTitle: "Find your home",
    formSubtitle: "See homes you can qualify for.",
    ctaLabel: "Find my home",
    bannerCta: "See available homes",
    features: [
      { icon: "🔑", title: "Skip the bank", body: "Move in now and work toward ownership — no traditional mortgage approval required." },
      { icon: "✅", title: "Credit-friendly", body: "Past credit issues don't disqualify you. We look at the whole picture." },
      { icon: "🛣️", title: "A clear path", body: "Simple terms and a defined route from renter to homeowner." },
    ],
  },
  owner: {
    label: "Owner-finance buyers",
    eyebrow: "Owner financing available",
    headline: "Buy a home with owner financing.",
    subhead:
      "Skip the mortgage maze. Get matched to owner-financed homes with flexible down payments and terms that actually fit your budget.",
    stat: "Flexible terms, real approvals",
    formTitle: "Get matched",
    formSubtitle: "Tell us what you're looking for.",
    ctaLabel: "Get matched",
    bannerCta: "Find owner-financed homes",
    features: [
      { icon: "🏦", title: "No bank required", body: "Finance directly through the seller — no conventional mortgage needed." },
      { icon: "📝", title: "Flexible terms", body: "Down payments and monthly plans built around your real budget." },
      { icon: "✅", title: "Credit-friendly", body: "Self-employed or past credit issues? You can still qualify." },
    ],
  },
  creative: {
    label: "Creative-terms buyers",
    eyebrow: "Creative & flexible terms",
    headline: "Flexible terms for serious buyers.",
    subhead:
      "Subject-to, lease options, and seller financing — get deals structured to work for your situation, sent to you before they're listed anywhere.",
    stat: "Deals structured to fit you",
    formTitle: "Join the list",
    formSubtitle: "Get creative-terms deals first.",
    ctaLabel: "Get matched to deals",
    bannerCta: "Join the buyers list",
    features: [
      { icon: "🧩", title: "Structured to fit", body: "Subject-to, lease options, seller financing — terms built around your goals." },
      { icon: "🎯", title: "Off-market first", body: "Get matched to deals before they're listed anywhere else." },
      { icon: "💡", title: "Real spreads", body: "Creative structures that still leave room to profit." },
    ],
  },
  land: {
    label: "Land buyers",
    eyebrow: "Off-market land & lots",
    headline: "Off-market land deals, priced to move.",
    subhead:
      "Raw land, lots, and acreage at investor prices. Join our list and get first access before they hit the open market.",
    stat: "Acreage & lots added weekly",
    formTitle: "Get land deals",
    formSubtitle: "New parcels by text and email.",
    ctaLabel: "Join the land list",
    bannerCta: "Get land deals",
    features: [
      { icon: "🌄", title: "Below-market parcels", body: "Raw land, lots, and acreage at prices the open market never sees." },
      { icon: "⚡", title: "First access", body: "Get new parcels by text the moment we have them." },
      { icon: "🖊️", title: "Close remotely", body: "Sign online and close from anywhere — no site visit required." },
    ],
  },
  commercial: {
    label: "Commercial buyers",
    eyebrow: "Commercial opportunities",
    headline: "Commercial deals for serious investors.",
    subhead:
      "Multifamily, retail, and mixed-use opportunities sent to our private commercial buyer network before they reach the broader market.",
    stat: "Multifamily, retail & mixed-use",
    formTitle: "Join the network",
    formSubtitle: "Off-market commercial deals.",
    ctaLabel: "Get commercial deals",
    bannerCta: "Join the network",
    features: [
      { icon: "🏢", title: "Off-market commercial", body: "Multifamily, retail, and mixed-use before they reach the broader market." },
      { icon: "📊", title: "Underwriting included", body: "Each opportunity comes with the figures you need to move quickly." },
      { icon: "🎯", title: "First look", body: "Our private network sees deals first." },
    ],
  },
  agent: {
    label: "Agents & realtors",
    eyebrow: "Off-market & coming soon",
    headline: "Get my listings before anyone else.",
    subhead:
      "Be the first to know about my off-market and coming-soon listings. Join my private buyer list and never miss a deal.",
    stat: "First access to my listings",
    formTitle: "Get first access",
    formSubtitle: "Coming-soon listings by text and email.",
    ctaLabel: "Join my VIP list",
    bannerCta: "Join the VIP list",
    features: [
      { icon: "⭐", title: "Coming-soon first", body: "See my off-market and coming-soon listings before they hit the portals." },
      { icon: "🎯", title: "Matched to your search", body: "Tell me what you want and I'll only send what fits." },
      { icon: "🔕", title: "No portal noise", body: "No spam, no junk — just real listings worth your time." },
    ],
  },
}

export function getPersona(id: SitePersona): PersonaContent {
  return PERSONAS[id] || PERSONAS.cash
}
