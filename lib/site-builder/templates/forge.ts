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
        props: { id: "AnnouncementBar-forge", text: c.announcement, enabled: "show" },
      },
      {
        type: "Nav",
        props: {
          id: "Nav-forge",
          brandName: "Your Company",
          logoUrl: "",
          phone: "(555) 555-5555",
          links: [
            { label: "Contact", href: "/contact" },
          ],
          layout: "stack",
        },
      },
      {
        type: "Hero",
        props: {
          id: "Hero-forge",
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
          id: "TrustBar-forge",
          items: c.trustBar,
        },
      },
      {
        type: "ProseSection",
        props: {
          id: "ProseSection-1-forge",
          eyebrow: c.prose[0].eyebrow,
          heading: c.prose[0].heading,
          bodyHtml: c.prose[0].bodyHtml,
          pullQuote: c.prose[0].pullQuote ?? "",
          ctaText: "",
          ctaHref: "",
        },
      },
      {
        type: "FeatureGrid",
        props: { id: "FeatureGrid-forge", heading: "Why people choose us", features: c.features },
      },
      {
        type: "SituationsGrid",
        props: {
          id: "SituationsGrid-forge",
          heading: c.situations.heading,
          intro: c.situations.intro,
          items: c.situations.items,
        },
      },
      {
        type: "HowItWorks",
        props: { id: "HowItWorks-forge", heading: "How it works", steps: c.howItWorks },
      },
      {
        type: "TypesGrid",
        props: { id: "TypesGrid-forge", heading: "What we send", intro: "", items: c.types },
      },
      { type: "PropertyGrid", props: { id: "PropertyGrid-forge", heading: "Recent deals" } },
      ...(c.prose[1]
        ? [
            {
              type: "ProseSection",
              props: {
                id: "ProseSection-2-forge",
                eyebrow: c.prose[1].eyebrow,
                heading: c.prose[1].heading,
                bodyHtml: c.prose[1].bodyHtml,
                pullQuote: c.prose[1].pullQuote ?? "",
                ctaText: "",
                ctaHref: "",
              },
            },
          ]
        : []),
      {
        type: "AreasServed",
        props: {
          id: "AreasServed-forge",
          heading: c.areas.heading,
          intro: c.areas.intro,
          singleLine: c.areas.singleLine,
          areas: [],
        },
      },
      {
        type: "ReviewsWall",
        props: {
          id: "ReviewsWall-forge",
          heading: "What buyers say",
          emptyText: "No reviews yet — they'll appear here as buyers close deals from the list.",
          reviews: [],
        },
      },
      {
        type: "RecentPosts",
        props: { id: "RecentPosts-forge", heading: "From the blog", intro: "", posts: [] },
      },
      {
        type: "Faq",
        props: { id: "Faq-forge", heading: "Questions & answers", items: c.faqs },
      },
      {
        type: "CtaBand",
        props: { id: "CtaBand-forge", heading: "Your offer is waiting", body: c.subhead, buttonLabel: c.bannerCta },
      },
      { type: "Footer", props: { id: "Footer-forge", text: "© Your Company. All rights reserved." } },
    ],
  }
  return data as Data
}

export const forge: SiteTemplateDef = {
  id: "forge",
  name: "Oak",
  description: "High-contrast color band hero with an inline form — punchy, urgent, and impossible to miss.",
  defaultTheme: { primary: PRIMARY, accent: ACCENT, headerLayout: "stack", banner: true },
  heroVariant: "band",
  build,
}

export default forge
