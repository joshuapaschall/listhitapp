// Pure, client-safe helpers for the multi-page wizard preview. Given the composed
// home Puck data, build the Puck data for each editable sub-page using the same
// generators the published site uses, plus legal-doc args. No server imports.

import {
  buildAboutPage,
  buildFaqPage,
  buildHowItWorksPage,
  buildReviewsPage,
  buildBuyersListPage,
  buildContactPage,
} from "@/lib/site-builder/extra-pages"
import { buildPrivacyPolicy, buildTermsOfService, type LegalDoc } from "@/lib/site-builder/compliance"
import type { SitePersona, SiteBusiness, SiteMarkets } from "@/lib/site-builder/types"

// The full set of pages the preview can show, in nav-ish order. `label` drives the
// toolbar dropdown; `path` is what link clicks resolve to.
export const PREVIEW_PAGES: { path: string; label: string }[] = [
  { path: "/", label: "Home" },
  { path: "/properties", label: "Deals" },
  { path: "/about", label: "About" },
  { path: "/faq", label: "FAQ" },
  { path: "/how-it-works", label: "How it works" },
  { path: "/buyers", label: "Buyers list" },
  { path: "/reviews", label: "Reviews" },
  { path: "/contact", label: "Contact" },
  { path: "/blog", label: "Blog" },
  { path: "/get-on-the-list", label: "Get deals (join)" },
  { path: "/privacy", label: "Privacy" },
  { path: "/terms", label: "Terms" },
]

// Normalize a clicked href to a known preview path (drop trailing slash; default "/").
export function normalizePreviewPath(href: string): string {
  if (!href) return "/"
  const noHash = href.split("#")[0].split("?")[0]
  const trimmed = noHash.replace(/\/+$/, "")
  return trimmed === "" ? "/" : trimmed
}

// Build the Puck data for an editable sub-page from the composed home Puck data.
// Returns null for paths that are NOT Puck pages (those render as React components
// in site-preview.tsx) or unknown paths.
export function buildPreviewPuck(
  path: string,
  composedHome: any,
  persona: SitePersona,
  business: SiteBusiness,
  markets: SiteMarkets,
): any | null {
  switch (path) {
    case "/":
      return composedHome
    case "/about":
      return buildAboutPage(composedHome, persona)
    case "/faq":
      return buildFaqPage(composedHome, persona)
    case "/how-it-works":
      return buildHowItWorksPage(composedHome, persona)
    case "/reviews":
      return buildReviewsPage(composedHome)
    case "/buyers":
      return buildBuyersListPage(composedHome, persona)
    case "/contact": {
      const cityState = [business.city, business.state].filter(Boolean).join(", ")
      const serviceArea =
        markets?.scope === "specific" && Array.isArray(markets.markets) && markets.markets.length
          ? markets.markets.slice(0, 3).join(", ")
          : cityState
      return buildContactPage(composedHome, {
        phone: business.phone,
        email: business.email,
        hours: (business as any).hours,
        serviceArea,
      })
    }
    default:
      return null
  }
}

// Legal doc for the preview (real generated text, best-effort args from the wizard).
export function buildPreviewLegalDoc(kind: "privacy" | "terms", brandName: string, business: SiteBusiness): LegalDoc {
  const cityState = [business.city, business.state].filter(Boolean).join(", ")
  const address = [business.address, cityState, business.zip].filter(Boolean).join(", ")
  const args = {
    legalName: brandName,
    brand: brandName,
    phone: business.phone || "",
    email: business.email || "",
    website: "",
    address,
  }
  return kind === "privacy" ? buildPrivacyPolicy(args) : buildTermsOfService(args)
}
