import type { SitePersona } from "@/lib/site-builder/types"

export interface PlaceholderDeal { badge: string; specs: string[]; priceBlur: boolean }

const BY_PERSONA: Record<SitePersona, PlaceholderDeal[]> = {
  cash: [
    { badge: "~32% under retail", specs: ["3 bd", "2 ba", "1,480 sqft", "ARV $285k"], priceBlur: true },
    { badge: "~41% under retail", specs: ["2 bd", "1 ba", "1,050 sqft", "ARV $172k"], priceBlur: true },
    { badge: "~36% under retail", specs: ["4 bd", "2 ba", "1,820 sqft", "ARV $240k"], priceBlur: true },
    { badge: "~38% under retail", specs: ["3 bd", "1.5 ba", "1,360 sqft", "ARV $205k"], priceBlur: true },
    { badge: "~29% under retail", specs: ["4 bd", "3 ba", "2,100 sqft", "ARV $320k"], priceBlur: true },
    { badge: "~44% under retail", specs: ["2 bd", "1 ba", "980 sqft", "ARV $160k"], priceBlur: true },
  ],
  investor: [
    { badge: "Fix & flip", specs: ["3 bd", "2 ba", "1,520 sqft", "ARV $290k"], priceBlur: true },
    { badge: "Cash-flow rental", specs: ["3 bd", "2 ba", "1,400 sqft", "Rent $1,850/mo"], priceBlur: true },
    { badge: "BRRRR-ready", specs: ["4 bd", "2 ba", "1,760 sqft", "ARV $255k"], priceBlur: true },
    { badge: "Value-add duplex", specs: ["2 units", "1,900 sqft", "Rent $2,600/mo"], priceBlur: true },
    { badge: "Fix & flip", specs: ["3 bd", "1.5 ba", "1,280 sqft", "ARV $215k"], priceBlur: true },
    { badge: "Cash-flow rental", specs: ["2 bd", "1 ba", "1,020 sqft", "Rent $1,400/mo"], priceBlur: true },
  ],
  rto: [
    { badge: "Rent-to-own", specs: ["3 bd", "2 ba", "$1,750/mo", "$5,000 move-in"], priceBlur: false },
    { badge: "Lease option", specs: ["2 bd", "1 ba", "$1,350/mo", "$3,500 move-in"], priceBlur: false },
    { badge: "Rent-to-own", specs: ["4 bd", "2 ba", "$2,150/mo", "$7,500 move-in"], priceBlur: false },
    { badge: "Lease purchase", specs: ["3 bd", "1.5 ba", "$1,600/mo", "$4,500 move-in"], priceBlur: false },
    { badge: "Rent-to-own", specs: ["3 bd", "2 ba", "$1,900/mo", "$6,000 move-in"], priceBlur: false },
    { badge: "Lease option", specs: ["2 bd", "1 ba", "$1,250/mo", "$3,000 move-in"], priceBlur: false },
  ],
  owner: [
    { badge: "Owner finance", specs: ["3 bd", "2 ba", "$12,000 down", "$1,650/mo"], priceBlur: false },
    { badge: "Seller carry", specs: ["2 bd", "1 ba", "$8,000 down", "$1,250/mo"], priceBlur: false },
    { badge: "Owner finance", specs: ["4 bd", "2 ba", "$18,000 down", "$2,050/mo"], priceBlur: false },
    { badge: "Low down", specs: ["3 bd", "1.5 ba", "$10,000 down", "$1,500/mo"], priceBlur: false },
    { badge: "Owner finance", specs: ["3 bd", "2 ba", "$15,000 down", "$1,800/mo"], priceBlur: false },
    { badge: "Seller carry", specs: ["2 bd", "1 ba", "$7,500 down", "$1,150/mo"], priceBlur: false },
  ],
  creative: [
    { badge: "Subject-to", specs: ["3 bd", "2 ba", "Existing 4.2% loan", "$1,540/mo PITI"], priceBlur: true },
    { badge: "Seller carry", specs: ["2 bd", "1 ba", "10% down", "Terms negotiable"], priceBlur: true },
    { badge: "Lease option", specs: ["4 bd", "2 ba", "Option fee $6k", "Price locked"], priceBlur: true },
    { badge: "Subject-to", specs: ["3 bd", "1.5 ba", "Existing 3.9% loan", "$1,320/mo PITI"], priceBlur: true },
    { badge: "Seller carry", specs: ["3 bd", "2 ba", "5% down", "Terms negotiable"], priceBlur: true },
    { badge: "Lease option", specs: ["2 bd", "1 ba", "Option fee $4k", "Price locked"], priceBlur: true },
  ],
  land: [
    { badge: "~34% under market", specs: ["5.2 acres", "Zoned residential", "Utilities at road"], priceBlur: true },
    { badge: "Buildable lot", specs: ["0.4 acres", "Infill", "City water/sewer"], priceBlur: true },
    { badge: "~40% under market", specs: ["20 acres", "Recreational", "Road access"], priceBlur: true },
    { badge: "Buildable lot", specs: ["0.6 acres", "Zoned residential", "Power at road"], priceBlur: true },
    { badge: "~28% under market", specs: ["10 acres", "Agricultural", "Well & septic"], priceBlur: true },
    { badge: "Development parcel", specs: ["3.1 acres", "Zoned multi", "Utilities available"], priceBlur: true },
  ],
  commercial: [
    { badge: "Value-add", specs: ["12 units", "9,400 sqft", "6.1% cap"], priceBlur: true },
    { badge: "Stabilized", specs: ["8 units", "7,200 sqft", "5.8% cap"], priceBlur: true },
    { badge: "Value-add", specs: ["Retail strip", "11,000 sqft", "Under-rented"], priceBlur: true },
    { badge: "Office", specs: ["6,800 sqft", "Below replacement", "Flex layout"], priceBlur: true },
    { badge: "Value-add", specs: ["20 units", "16,500 sqft", "6.5% cap"], priceBlur: true },
    { badge: "Mixed-use", specs: ["4 units + retail", "8,900 sqft", "Two income streams"], priceBlur: true },
  ],
  agent: [
    { badge: "Pocket listing", specs: ["3 bd", "2 ba", "1,560 sqft", "List $285k"], priceBlur: true },
    { badge: "Coming soon", specs: ["4 bd", "3 ba", "2,200 sqft", "List $415k"], priceBlur: true },
    { badge: "Off-market", specs: ["2 bd", "1 ba", "1,040 sqft", "List $190k"], priceBlur: true },
    { badge: "Pocket listing", specs: ["3 bd", "2.5 ba", "1,880 sqft", "List $340k"], priceBlur: true },
    { badge: "Coming soon", specs: ["3 bd", "2 ba", "1,420 sqft", "List $265k"], priceBlur: true },
    { badge: "Off-market", specs: ["4 bd", "2 ba", "1,700 sqft", "List $310k"], priceBlur: true },
  ],
}

export function placeholderDealsFor(persona: SitePersona): PlaceholderDeal[] {
  return BY_PERSONA[persona] || BY_PERSONA.cash
}
