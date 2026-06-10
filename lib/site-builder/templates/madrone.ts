import type { Data } from "@measured/puck"
import type { SitePersona } from "../types"
import type { SiteTemplateDef } from "./types"
import { PERSONAS } from "./personas"

const PRIMARY = "#5a2a4d"
const ACCENT = "#e0654f"
const HEADING_FONT = "'Bricolage Grotesque', serif"

function build(persona: SitePersona): Data {
  const c = PERSONAS[persona]
  const data = {
    root: { props: { primary: PRIMARY, accent: ACCENT, headingFont: HEADING_FONT } },
    content: [
      {
        type: "AnnouncementBar",
        props: { id: "AnnouncementBar-madrone", text: c.announcement, enabled: "show" },
      },
      {
        type: "Nav",
        props: {
          id: "Nav-madrone",
          brandName: "Your Company",
          logoUrl: "",
          phone: "(555) 555-5555",
          links: [
            { label: "How it works", href: "#how-it-works" },
            { label: "Reviews", href: "#reviews" },
            { label: "Contact", href: "/contact" },
          ],
          layout: "split",
        },
      },
      {
        type: "Hero",
        props: {
          id: "Hero-madrone",
          variant: "split",
          eyebrow: c.eyebrow,
          headline: c.headline,
          subhead: c.subhead,
          stat: c.stat,
          imageUrl: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=1600",
          formTitle: c.formTitle,
          formSubtitle: c.formSubtitle,
          ctaLabel: c.ctaLabel,
        },
      },
      {
        type: "TrustBar",
        props: {
          id: "TrustBar-madrone",
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
        props: { id: "FeatureGrid-madrone", heading: "What you get", features: c.features },
      },
      {
        type: "HowItWorks",
        props: { id: "HowItWorks-madrone", heading: "How it works", steps: c.howItWorks },
      },
      { type: "PropertyGrid", props: { id: "PropertyGrid-madrone", heading: "Recent deals" } },
      {
        type: "Testimonials",
        props: { id: "Testimonials-madrone", heading: "What buyers say", reviews: [] },
      },
      {
        type: "Faq",
        props: { id: "Faq-madrone", heading: "Questions & answers", items: c.faqs },
      },
      {
        type: "CtaBand",
        props: { id: "CtaBand-madrone", heading: "Get your offer today", body: c.subhead, buttonLabel: c.bannerCta },
      },
      { type: "Footer", props: { id: "Footer-madrone", text: "© Your Company. All rights reserved." } },
    ],
  }
  return data as Data
}

export const madrone: SiteTemplateDef = {
  id: "madrone",
  name: "Madrone",
  description: "Split hero with the form left and a photo + stat overlay right — conversion-focused and modern.",
  defaultTheme: { primary: PRIMARY, accent: ACCENT, headerLayout: "split", banner: true },
  heroVariant: "split",
  build,
}

export default madrone
