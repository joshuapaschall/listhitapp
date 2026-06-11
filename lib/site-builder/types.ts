export type SitePersona =
  | "cash"
  | "investor"
  | "rto"
  | "owner"
  | "creative"
  | "land"
  | "commercial"
  | "agent"

export type SiteTemplateId = "marquee" | "haven" | "vantage" | "forge"

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
  // Stats strip (feed TrustBar). Persona-specific — 4 short value/label pairs.
  // `value` renders large/bold (~34px); keep it to ~1–3 words. `label` is the
  // small supporting line. Tokens {Brand}/{City} are interpolated at render time.
  trustBar: { value: string; label: string }[]
  features: { icon: string; title: string; body: string }[]
  // Expanded site copy. `{Brand}` / `{City}` are render-time placeholders
  // (City falls back to "your area" on nationwide sites).
  announcement: string
  howItWorks: { title: string; body: string }[]
  faqs: { q: string; a: string }[]
  about: { headline: string; body: string; trust: string[] }
  // Long-form, keyword-rich editorial sections (feed ProseSection).
  // bodyHtml is simple HTML (<p>, <b>, <a href="/...">) — tokens {Brand}/{City} allowed.
  prose: { eyebrow: string; heading: string; bodyHtml: string; pullQuote?: string }[]
  // "Types of deals" cards (feed TypesGrid). href is a relative path (e.g. "/properties").
  types: { title: string; body: string; href: string }[]
  // Areas-served copy (feed AreasServed). The block decides chips vs. single line by
  // data; these are the surrounding strings only — no hardcoded place names.
  areas: { heading: string; intro: string; singleLine: string }
  // "Situations we buy" cards (feed SituationsGrid).
  situations: {
    heading: string
    intro: string
    items: { icon: string; title: string; body: string; href: string }[]
  }
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
    enabled: boolean         // always on — opt-in is mandatory for texting approval
    requireConsent: boolean  // always true — kept for back-compat
    // Two-checkbox consent labels. System-derived from the legal business name at
    // render time (see buildConsentTexts); fixed wording, never user-editable.
    consentMarketing?: string
    consentNonMarketing?: string
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
  year_built: number | null
  lot_size: string | null
  mls_number: string | null
  construction_type: string | null
  photo_album_url: string | null
  video_link: string | null
  images: DealImage[]
}

export interface PostSummary {
  id: string
  slug: string
  title: string
  excerpt: string | null
  featuredImageUrl: string | null
  featuredImageAlt: string | null
  publishedAt: string | null
}

export interface PostDetail extends PostSummary {
  bodyHtml: string | null
  metaTitle: string | null
  metaDescription: string | null
  ogImageUrl: string | null
  focusKeyword: string | null
  authorName: string | null
  seoScore: number | null
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
