import { PERSONAS } from "./templates/personas"
import type { SitePersona } from "./types"

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}
function pick(home: any, type: string) {
  const b = (home?.content || []).find((x: any) => x?.type === type)
  return b ? clone(b) : null
}
// Sub-pages can't use home-only "#anchor" links; make them root-relative so
// they navigate home then scroll.
function rootRelativeAnchors(nav: any) {
  if (nav?.props?.links) {
    nav.props.links = nav.props.links.map((l: any) =>
      l?.href && l.href.startsWith("#") ? { ...l, href: "/" + l.href } : l,
    )
  }
  return nav
}
function reid(block: any, suffix: string) {
  if (block?.props?.id) block.props.id = `${block.props.id}${suffix}`
  return block
}

export function buildAboutPage(home: any, persona: SitePersona) {
  const c = PERSONAS[persona]
  const nav = reid(rootRelativeAnchors(pick(home, "Nav")), "-about")
  const cta = reid(pick(home, "CtaBand"), "-about")
  const footer = reid(pick(home, "Footer"), "-about")
  const about = {
    type: "AboutStory",
    props: {
      id: "AboutStory-about",
      headline: c.about.headline,
      body: c.about.body,
      trust: (c.about.trust || []).map((t) => ({ text: t })),
      stats: [],
    },
  }
  return { root: clone(home?.root || {}), content: [nav, about, cta, footer].filter(Boolean) }
}

export function buildFaqPage(home: any, persona: SitePersona) {
  const c = PERSONAS[persona]
  const nav = reid(rootRelativeAnchors(pick(home, "Nav")), "-faq")
  const cta = reid(pick(home, "CtaBand"), "-faq")
  const footer = reid(pick(home, "Footer"), "-faq")
  const faq = { type: "Faq", props: { id: "Faq-page", heading: "Questions & answers", items: c.faqs } }
  return { root: clone(home?.root || {}), content: [nav, faq, cta, footer].filter(Boolean) }
}
