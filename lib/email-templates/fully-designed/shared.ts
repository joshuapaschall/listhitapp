import {
  createDividerBlock,
  createImageBlock,
  createParagraphBlock,
  createSocialIconsBlock,
  createSpacerBlock,
} from "@templatical/types"
import type { TemplateContent } from "@templatical/types"
import { DEFAULT_BRAND, type BrandConfig } from "../brand"
import { PLACEHOLDER_IMAGE } from "../types"

export const NAVY = DEFAULT_BRAND.colors.navy
export const ORANGE = DEFAULT_BRAND.colors.orange
export const CREAM = DEFAULT_BRAND.colors.cream
export const MUTED = DEFAULT_BRAND.colors.muted
export const HEAD = DEFAULT_BRAND.fonts.heading
export const BODY = DEFAULT_BRAND.fonts.body

export const withPreheader = (c: TemplateContent, text: string): TemplateContent => {
  c.settings.preheaderText = text
  return c
}

export const logoBlock = (brand: BrandConfig = DEFAULT_BRAND) => {
  const b = createImageBlock({
    src: PLACEHOLDER_IMAGE,
    alt: `${brand.companyName} logo`,
    width: 160,
  })
  b.styles = {
    padding: { top: 20, right: 0, bottom: 8, left: 0 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  }
  return b
}

export const brandedFooter = (brand: BrandConfig = DEFAULT_BRAND) => {
  const socialEntries = (["facebook", "instagram", "youtube"] as const)
    .map((platform) => ({ platform, url: brand.socials[platform] }))
    .filter((e): e is { platform: typeof e.platform; url: string } => Boolean(e.url))

  return [
    createDividerBlock({ color: DEFAULT_BRAND.colors.divider, thickness: 1 }),
    ...(socialEntries.length > 0
      ? [
          createSocialIconsBlock({
            iconStyle: "solid",
            iconSize: "medium",
            icons: socialEntries.map((entry) => ({
              id: crypto.randomUUID(),
              platform: entry.platform,
              url: entry.url,
            })),
          }),
        ]
      : []),
    createParagraphBlock({
      // Colors stay on the design palette; the name and address are the org's.
      content: `<p style="color:${DEFAULT_BRAND.colors.muted};font-size:12px;text-align:center;line-height:1.6;margin:0">${brand.companyName}<br/>${brand.tagline}<br/>${brand.address}</p>`,
    }),
    createSpacerBlock({ height: 16 }),
  ]
}
