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
    root: { props: { primary: PRIMARY, accent: ACCENT, headingFont: HEADING_FONT, layout: "marquee" } },
    content: [
      {
        type: "AnnouncementBar",
        props: { id: "AnnouncementBar-marquee", text: c.announcement, enabled: "show" },
      },
      {
        type: "Nav",
        props: {
          id: "Nav-marquee",
          brandName: "Your Company",
          logoUrl: "",
          phone: "(555) 555-5555",
          links: [
            { label: "Contact", href: "/contact" },
          ],
          layout: "split",
        },
      },
      {
        type: "Hero",
        props: {
          id: "Hero-marquee",
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
          id: "TrustBar-marquee",
          items: c.trustBar,
        },
      },
      {
        type: "ProseSection",
        props: {
          id: "ProseSection-1-marquee",
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
        props: { id: "FeatureGrid-marquee", heading: "Why people choose us", features: c.features },
      },
      {
        type: "SituationsGrid",
        props: {
          id: "SituationsGrid-marquee",
          heading: c.situations.heading,
          intro: c.situations.intro,
          items: c.situations.items,
        },
      },
      {
        type: "HowItWorks",
        props: { id: "HowItWorks-marquee", heading: "How it works", steps: c.howItWorks },
      },
      {
        type: "TypesGrid",
        props: { id: "TypesGrid-marquee", heading: "What we send", intro: "", items: c.types },
      },
      { type: "PropertyGrid", props: { id: "PropertyGrid-marquee", heading: "Recent deals" } },
      ...(c.prose[1]
        ? [
            {
              type: "ProseSection",
              props: {
                id: "ProseSection-2-marquee",
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
          id: "AreasServed-marquee",
          heading: c.areas.heading,
          intro: c.areas.intro,
          singleLine: c.areas.singleLine,
          areas: [],
        },
      },
      {
        type: "ReviewsWall",
        props: {
          id: "ReviewsWall-marquee",
          heading: "What buyers say",
          emptyText: "No reviews yet — they'll appear here as buyers close deals from the list.",
          reviews: [],
        },
      },
      {
        type: "RecentPosts",
        props: { id: "RecentPosts-marquee", heading: "From the blog", intro: "", posts: [] },
      },
      {
        type: "Faq",
        props: { id: "Faq-marquee", heading: "Questions & answers", items: c.faqs },
      },
      {
        type: "ConversionBand",
        props: {
          id: "ConversionBand-marquee",
          heading: "Ready to see the deals?",
          body: c.subhead,
          formTitle: c.formTitle,
          ctaLabel: c.ctaLabel,
        },
      },
      { type: "Footer", props: { id: "Footer-marquee", text: "© Your Company. All rights reserved." } },
    ],
  }
  return data as Data
}

export const marquee: SiteTemplateDef = {
  id: "marquee",
  name: "Marquee",
  description: "Bold full-bleed photo hero with a floating form — high-impact and trust-forward.",
  defaultTheme: { primary: PRIMARY, accent: ACCENT, headerLayout: "split", banner: true },
  heroVariant: "photo",
  build,
}

export default marquee
