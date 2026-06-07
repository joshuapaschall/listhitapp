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
