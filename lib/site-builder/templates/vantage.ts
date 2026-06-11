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
        props: { id: "AnnouncementBar-vantage", text: c.announcement, enabled: "show" },
      },
      {
        type: "Nav",
        props: {
          id: "Nav-vantage",
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
          id: "Hero-vantage",
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
          id: "TrustBar-vantage",
          items: c.trustBar,
        },
      },
      {
        type: "ProseSection",
        props: {
          id: "ProseSection-1-vantage",
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
        props: { id: "FeatureGrid-vantage", heading: "What you get", features: c.features },
      },
      {
        type: "SituationsGrid",
        props: {
          id: "SituationsGrid-vantage",
          heading: c.situations.heading,
          intro: c.situations.intro,
          items: c.situations.items,
        },
      },
      {
        type: "HowItWorks",
        props: { id: "HowItWorks-vantage", heading: "How it works", steps: c.howItWorks },
      },
      {
        type: "TypesGrid",
        props: { id: "TypesGrid-vantage", heading: "What we send", intro: "", items: c.types },
      },
      { type: "PropertyGrid", props: { id: "PropertyGrid-vantage", heading: "Recent deals" } },
      ...(c.prose[1]
        ? [
            {
              type: "ProseSection",
              props: {
                id: "ProseSection-2-vantage",
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
          id: "AreasServed-vantage",
          heading: c.areas.heading,
          intro: c.areas.intro,
          singleLine: c.areas.singleLine,
          areas: [],
        },
      },
      {
        type: "ReviewsWall",
        props: {
          id: "ReviewsWall-vantage",
          heading: "What buyers say",
          emptyText: "No reviews yet — they'll appear here as buyers close deals from the list.",
          reviews: [],
        },
      },
      {
        type: "RecentPosts",
        props: { id: "RecentPosts-vantage", heading: "From the blog", intro: "", posts: [] },
      },
      {
        type: "Faq",
        props: { id: "Faq-vantage", heading: "Questions & answers", items: c.faqs },
      },
      {
        type: "CtaBand",
        props: { id: "CtaBand-vantage", heading: "Get your offer today", body: c.subhead, buttonLabel: c.bannerCta },
      },
      { type: "Footer", props: { id: "Footer-vantage", text: "© Your Company. All rights reserved." } },
    ],
  }
  return data as Data
}

export const vantage: SiteTemplateDef = {
  id: "vantage",
  name: "Madrone",
  description: "Split hero with the form left and a photo + stat overlay right — conversion-focused and modern.",
  defaultTheme: { primary: PRIMARY, accent: ACCENT, headerLayout: "split", banner: true },
  heroVariant: "split",
  build,
}

export default vantage
