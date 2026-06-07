import type { Data } from "@measured/puck"
import type { SitePersona } from "../types"
import type { SiteTemplateDef } from "./types"
import { PERSONAS } from "./personas"

const PRIMARY = "#1f5d4c"
const ACCENT = "#d98c2b"
const HEADING_FONT = "'Bricolage Grotesque', serif"

function build(persona: SitePersona): Data {
  const c = PERSONAS[persona]
  const data = {
    root: { props: { primary: PRIMARY, accent: ACCENT, headingFont: HEADING_FONT } },
    content: [
      {
        type: "Nav",
        props: {
          id: "Nav-cedar",
          brandName: "Your Company",
          logoUrl: "",
          phone: "(555) 555-5555",
          links: [{ label: "How it works" }, { label: "Reviews" }, { label: "Contact" }],
          layout: "center",
        },
      },
      {
        type: "Hero",
        props: {
          id: "Hero-cedar",
          variant: "centered",
          eyebrow: c.eyebrow,
          headline: c.headline,
          subhead: c.subhead,
          stat: c.stat,
          imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600",
          formTitle: c.formTitle,
          formSubtitle: c.formSubtitle,
          ctaLabel: c.ctaLabel,
        },
      },
      {
        type: "TrustBar",
        props: {
          id: "TrustBar-cedar",
          items: [{ label: "Locally owned" }, { label: "No commissions" }, { label: "Fast closings" }, { label: "Trusted since day one" }],
        },
      },
      {
        type: "FeatureGrid",
        props: { id: "FeatureGrid-cedar", heading: "How it works", features: c.features },
      },
      { type: "PropertyGrid", props: { id: "PropertyGrid-cedar", heading: "Recent deals" } },
      {
        type: "CtaBand",
        props: { id: "CtaBand-cedar", heading: "Let's get started", body: c.subhead, buttonLabel: c.bannerCta },
      },
      { type: "Footer", props: { id: "Footer-cedar", text: "© Your Company. All rights reserved." } },
    ],
  }
  return data as Data
}

export const cedar: SiteTemplateDef = {
  id: "cedar",
  name: "Cedar",
  description: "Calm centered hero with an inline form row — friendly, editorial, and easy to scan.",
  defaultTheme: { primary: PRIMARY, accent: ACCENT, headerLayout: "center", banner: false },
  heroVariant: "centered",
  build,
}

export default cedar
