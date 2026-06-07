export type SitePersona =
  | "cash"
  | "investor"
  | "rto"
  | "owner"
  | "creative"
  | "land"
  | "commercial"
  | "agent"

export type SiteTemplateId = "aspen" | "cedar" | "madrone" | "oak"

export type HeaderLayout = "split" | "center" | "stack"

export interface SiteTheme {
  primary: string
  accent: string
  typeStyleId: string   // id from lib/site-builder/typography.ts TYPE_STYLES
  headingFont: string   // resolved CSS font-family value (kept for back-compat / Root props)
  bodyFont: string      // resolved CSS font-family value
  logoUrl?: string
  headerLayout: HeaderLayout
  banner: boolean
}

export interface PersonaContent {
  label: string        // plain wizard label, e.g. "Cash buyers"
  eyebrow: string
  headline: string
  subhead: string
  stat: string
  formTitle: string
  formSubtitle: string
  ctaLabel: string
  bannerCta: string
  features: { icon: string; title: string; body: string }[]
}

export const DEFAULT_THEME: SiteTheme = {
  primary: "#0f2a43",
  accent: "#f5a623",
  typeStyleId: "bold",
  headingFont: "'Montserrat', sans-serif",
  bodyFont: "'Source Sans 3', sans-serif",
  headerLayout: "split",
  banner: true,
}

export interface SiteBusinessSocial {
  facebook?: string
  instagram?: string
  youtube?: string
  linkedin?: string
  tiktok?: string
}

export interface SiteBusiness {
  email: string
  phone: string
  address: string   // street line
  city: string
  state: string     // 2-letter
  zip: string
  social: SiteBusinessSocial
  optin: {
    enabled: boolean         // show SMS opt-in disclosure on forms
    requireConsent: boolean  // require an explicit consent checkbox
  }
}

export interface DealSummary {
  id: string
  slug: string
  address: string | null
  city: string | null
  state: string | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  property_type: string | null
  primary_image_url: string | null
}

export interface DealImage {
  image_url: string
  is_featured: boolean
}

export interface DealDetail extends DealSummary {
  zip: string | null
  description: string | null
  deal_type: string | null
  finance_subtype: string | null
  status: string | null
  images: DealImage[]
}

export interface SiteMarkets {
  scope: "nationwide" | "specific"
  markets: string[]   // canonical location strings: "Atlanta (GA)", "Fulton County (GA)", "GA, USA"
}

export const DEFAULT_MARKETS: SiteMarkets = {
  scope: "nationwide",
  markets: [],
}

export const DEFAULT_BUSINESS: SiteBusiness = {
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  social: {},
  optin: { enabled: true, requireConsent: true },
}
