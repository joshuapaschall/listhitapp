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
    root: { props: { primary: PRIMARY, accent: ACCENT, headingFont: HEADING_FONT, layout: "haven" } },
    content: [
      {
        type: "AnnouncementBar",
        props: { id: "AnnouncementBar-haven", text: c.announcement, enabled: "hide" },
      },
      {
        type: "Nav",
        props: {
          id: "Nav-haven",
          brandName: "Your Company",
          logoUrl: "",
          phone: "(555) 555-5555",
          links: [
            { label: "Contact", href: "/contact" },
          ],
          layout: "center",
        },
      },
      {
        type: "Hero",
        props: {
          id: "Hero-haven",
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
          id: "TrustBar-haven",
          items: c.trustBar,
        },
      },
      {
        type: "ProseSection",
        props: {
          id: "ProseSection-1-haven",
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
        props: { id: "FeatureGrid-haven", heading: "Why people choose us", features: c.features },
      },
      {
        type: "SituationsGrid",
        props: {
          id: "SituationsGrid-haven",
          heading: c.situations.heading,
          intro: c.situations.intro,
          items: c.situations.items,
        },
      },
      {
        type: "HowItWorks",
        props: { id: "HowItWorks-haven", heading: "How it works", steps: c.howItWorks },
      },
      {
        type: "TypesGrid",
        props: { id: "TypesGrid-haven", heading: "What we send", intro: "", items: c.types },
      },
      { type: "PropertyGrid", props: { id: "PropertyGrid-haven", heading: "Recent deals" } },
      ...(c.prose[1]
        ? [
            {
              type: "ProseSection",
              props: {
                id: "ProseSection-2-haven",
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
          id: "AreasServed-haven",
          heading: c.areas.heading,
          intro: c.areas.intro,
          singleLine: c.areas.singleLine,
          areas: [],
        },
      },
      {
        type: "ReviewsWall",
        props: {
          id: "ReviewsWall-haven",
          heading: "What buyers say",
          emptyText: "No reviews yet — they'll appear here as buyers close deals from the list.",
          reviews: [],
        },
      },
      {
        type: "RecentPosts",
        props: { id: "RecentPosts-haven", heading: "From the blog", intro: "", posts: [] },
      },
      {
        type: "Faq",
        props: { id: "Faq-haven", heading: "Questions & answers", items: c.faqs },
      },
      {
        type: "ConversionBand",
        props: {
          id: "ConversionBand-haven",
          heading: "Ready to see the deals?",
          body: c.subhead,
          formTitle: c.formTitle,
          ctaLabel: c.ctaLabel,
        },
      },
      { type: "Footer", props: { id: "Footer-haven", text: "© Your Company. All rights reserved." } },
    ],
  }
  return data as Data
}

export const haven: SiteTemplateDef = {
  id: "haven",
  name: "Haven",
  description: "Calm, centered editorial hero with an inline form — refined and trustworthy.",
  defaultTheme: { primary: PRIMARY, accent: ACCENT, headerLayout: "center", banner: false },
  heroVariant: "centered",
  build,
}

export default haven
