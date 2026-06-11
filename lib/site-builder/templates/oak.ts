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
          items: c.trustBar,
        },
      },
      {
        type: "ProseSection",
        props: {
          id: "ProseSection-1-oak",
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
        props: { id: "FeatureGrid-oak", heading: "The simple way to sell", features: c.features },
      },
      {
        type: "SituationsGrid",
        props: {
          id: "SituationsGrid-oak",
          heading: c.situations.heading,
          intro: c.situations.intro,
          items: c.situations.items,
        },
      },
      {
        type: "HowItWorks",
        props: { id: "HowItWorks-oak", heading: "How it works", steps: c.howItWorks },
      },
      {
        type: "TypesGrid",
        props: { id: "TypesGrid-oak", heading: "What we send", intro: "", items: c.types },
      },
      { type: "PropertyGrid", props: { id: "PropertyGrid-oak", heading: "Recent deals" } },
      ...(c.prose[1]
        ? [
            {
              type: "ProseSection",
              props: {
                id: "ProseSection-2-oak",
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
          id: "AreasServed-oak",
          heading: c.areas.heading,
          intro: c.areas.intro,
          singleLine: c.areas.singleLine,
          areas: [],
        },
      },
      {
        type: "ReviewsWall",
        props: {
          id: "ReviewsWall-oak",
          heading: "What buyers say",
          emptyText: "No reviews yet — they'll appear here as buyers close deals from the list.",
          reviews: [],
        },
      },
      {
        type: "RecentPosts",
        props: { id: "RecentPosts-oak", heading: "From the blog", intro: "", posts: [] },
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
