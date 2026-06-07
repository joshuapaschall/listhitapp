import type { Data } from "@measured/puck"
import type { SitePersona } from "../types"
import type { SiteTemplateDef } from "./types"
import { PERSONAS } from "./personas"

const PRIMARY = "#173b5e"
const ACCENT = "#e8833a"
const HEADING_FONT = "'Bricolage Grotesque', serif"

function build(persona: SitePersona): Data {
  const c = PERSONAS[persona]
  const data = {
    root: { props: { primary: PRIMARY, accent: ACCENT, headingFont: HEADING_FONT } },
    content: [
      {
        type: "Nav",
        props: {
          id: "Nav-aspen",
          brandName: "Your Company",
          logoUrl: "",
          phone: "(555) 555-5555",
          links: [{ label: "How it works" }, { label: "Reviews" }, { label: "Contact" }],
          layout: "split",
        },
      },
      {
        type: "Hero",
        props: {
          id: "Hero-aspen",
          variant: "photo",
          eyebrow: c.eyebrow,
          headline: c.headline,
          subhead: c.subhead,
          stat: c.stat,
          imageUrl: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1600",
          formTitle: c.formTitle,
          formSubtitle: c.formSubtitle,
          ctaLabel: c.ctaLabel,
        },
      },
      {
        type: "TrustBar",
        props: {
          id: "TrustBar-aspen",
          items: [{ label: "A+ BBB rated" }, { label: "No fees" }, { label: "Close in 7 days" }, { label: "5-star reviews" }],
        },
      },
      {
        type: "FeatureGrid",
        props: { id: "FeatureGrid-aspen", heading: "Why people choose us", features: c.features },
      },
      { type: "PropertyGrid", props: { id: "PropertyGrid-aspen", heading: "Recent deals" } },
      {
        type: "CtaBand",
        props: { id: "CtaBand-aspen", heading: "Ready when you are", body: c.subhead, buttonLabel: c.bannerCta },
      },
      { type: "Footer", props: { id: "Footer-aspen", text: "© Your Company. All rights reserved." } },
    ],
  }
  return data as Data
}

export const aspen: SiteTemplateDef = {
  id: "aspen",
  name: "Aspen",
  description: "Bold full-bleed photo hero with a floating lead form — high-impact and trust-forward.",
  defaultTheme: { primary: PRIMARY, accent: ACCENT, headerLayout: "split", banner: true },
  heroVariant: "photo",
  build,
}

export default aspen
