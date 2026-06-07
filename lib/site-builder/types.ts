export type SitePersona =
  | "cash"
  | "land"
  | "owner"
  | "rto"
  | "commercial"
  | "agentinv"
  | "agentbuy"

export type SiteTemplateId = "aspen" | "cedar" | "madrone" | "oak"

export type HeaderLayout = "split" | "center" | "stack"

export interface SiteTheme {
  primary: string
  accent: string
  headingFont: string
  logoUrl?: string
  headerLayout: HeaderLayout
  banner: boolean
}

export interface PersonaContent {
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
  primary: "#173b5e",
  accent: "#e8833a",
  headingFont: "'Bricolage Grotesque', serif",
  headerLayout: "split",
  banner: true,
}
