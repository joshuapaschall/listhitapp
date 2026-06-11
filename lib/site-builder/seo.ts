import type { SitePersona } from "./types"

// Per-persona, keyword-first SEO building blocks. Used at render time to generate
// already-substituted title/meta strings — brand and city are passed in resolved
// (metadata is not interpolated downstream, so no render-time tokens may leak in).
type SeoEntry = { titleKw: string; listName: string; metaWhat: string }

const PERSONA_SEO: Record<SitePersona, SeoEntry> = {
  cash:       { titleKw: "Off-Market & Wholesale Deals",        listName: "cash buyers list",      metaWhat: "off-market and wholesale properties 30–50% under retail" },
  investor:   { titleKw: "Off-Market Investment Properties",     listName: "investor list",         metaWhat: "underwritten off-market flips and rentals with the numbers already run" },
  rto:        { titleKw: "Rent-to-Own Homes",                    listName: "rent-to-own list",      metaWhat: "rent-to-own homes you can move into now and buy when you're ready" },
  owner:      { titleKw: "Owner-Financed Homes",                 listName: "owner-finance list",    metaWhat: "owner-financed homes you can buy direct from the seller, no bank" },
  creative:   { titleKw: "Creative-Finance Real Estate Deals",   listName: "deals list",            metaWhat: "off-market deals built for subject-to, seller finance, and lease options" },
  land:       { titleKw: "Off-Market Land & Acreage",            listName: "land buyers list",      metaWhat: "off-market lots and acreage priced below market" },
  commercial: { titleKw: "Off-Market Commercial & Multifamily",  listName: "commercial buyers list",metaWhat: "off-market commercial and multifamily deals with upside" },
  agent:      { titleKw: "Off-Market & Pocket Listings",         listName: "agent list",            metaWhat: "off-market and pocket listings to bring your buyers" },
}

// Title-case the list name for use inside a title.
function tc(s: string): string { return s.replace(/\b\w/g, (m) => m.toUpperCase()) }

export function pageSeo(
  persona: SitePersona,
  path: string,
  brand: string,
  city: string,
): { title: string; description: string } | null {
  const s = PERSONA_SEO[persona] || PERSONA_SEO.cash
  const b = brand || "our team"
  const inCity = city ? ` in ${city}` : ""
  switch (path) {
    case "/":
      return {
        title: `${s.titleKw}${inCity} — ${tc(s.listName)}`,
        description: `Get ${s.metaWhat}${inCity}, sent first by text and email. Join the ${s.listName} free — no fees, no contract.`,
      }
    case "/how-it-works":
      return {
        title: `How It Works — ${s.titleKw}${inCity}`,
        description: `See how we find ${s.metaWhat}${inCity} and send them to the ${s.listName} first.`,
      }
    case "/buyers":
      return {
        title: `Join the ${tc(s.listName)}${inCity}`,
        description: `Join the ${s.listName} and get ${s.metaWhat}${inCity} by text and email. Free to join, no contract.`,
      }
    case "/faq":
      return {
        title: `${s.titleKw} — FAQ`,
        description: `Answers about ${s.metaWhat}, joining the ${s.listName}, and how it works.`,
      }
    case "/reviews":
      return { title: `Reviews — ${b}`, description: `See what buyers say about working with ${b}.` }
    case "/about":
      return {
        title: `About ${b} — ${s.titleKw}${inCity}`,
        description: `${b} finds ${s.metaWhat}${inCity} and sends them to buyers first.`,
      }
    default:
      return null
  }
}
