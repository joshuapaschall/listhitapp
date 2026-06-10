import type { Data } from "@measured/puck"
import type { SitePersona } from "../types"
import type { SiteTemplateDef } from "./types"
import { PERSONAS } from "./personas"

const PRIMARY = "#0f2a43"
const ACCENT = "#f0a500"
const HEADING_FONT = "'Bricolage Grotesque', serif"

function build(persona: SitePersona): Data {
  const c = PERSONAS[persona]
  const data = {
    root: { props: { primary: PRIMARY, accent: ACCENT, headingFont: HEADING_FONT } },
    content: [
      {
        type: "AnnouncementBar",
        props: { id: "AnnouncementBar-oak", text: c.announcement, enabled: "show" },
      },
      {
        type: "Nav",
        props: {
          id: "Nav-oak",
          brandName: "Your Company",
          logoUrl: "",
          phone: "(555) 555-5555",
          links: [
            { label: "How it works", href: "#how-it-works" },
            { label: "Reviews", href: "#reviews" },
            { label: "Contact", href: "/contact" },
          ],
          layout: "stack",
        },
      },
      {
        type: "Hero",
        props: {
          id: "Hero-oak",
          variant: "band",
          eyebrow: c.eyebrow,
          headline: c.headline,
          subhead: c.subhead,
          stat: c.stat,
          imageUrl: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1600",
          formTitle: c.formTitle,
          formSubtitle: c.formSubtitle,
          ctaLabel: c.ctaLabel,
        },
      },
      {
        type: "TrustBar",
        props: {
          id: "TrustBar-oak",
          items: [
            { value: "$0", label: "Fees to join" },
            { value: "<24h", label: "New deals to your inbox" },
            { value: "All cash", label: "Fast, certain closings" },
            { value: "Off-market", label: "Deals you won't find online" },
          ],
        },
      },
      {
        type: "FeatureGrid",
        props: { id: "FeatureGrid-oak", heading: "The simple way to sell", features: c.features },
      },
      {
        type: "HowItWorks",
        props: { id: "HowItWorks-oak", heading: "How it works", steps: c.howItWorks },
      },
      { type: "PropertyGrid", props: { id: "PropertyGrid-oak", heading: "Recent deals" } },
      {
        type: "Testimonials",
        props: { id: "Testimonials-oak", heading: "What buyers say", reviews: [] },
      },
      {
        type: "Faq",
        props: { id: "Faq-oak", heading: "Questions & answers", items: c.faqs },
      },
      {
        type: "CtaBand",
        props: { id: "CtaBand-oak", heading: "Your offer is waiting", body: c.subhead, buttonLabel: c.bannerCta },
      },
      { type: "Footer", props: { id: "Footer-oak", text: "© Your Company. All rights reserved." } },
    ],
  }
  return data as Data
}

export const oak: SiteTemplateDef = {
  id: "oak",
  name: "Oak",
  description: "High-contrast color band hero with an inline form — punchy, urgent, and impossible to miss.",
  defaultTheme: { primary: PRIMARY, accent: ACCENT, headerLayout: "stack", banner: true },
  heroVariant: "band",
  build,
}

export default oak
