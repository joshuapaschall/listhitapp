import {
  createDividerBlock,
  createImageBlock,
  createParagraphBlock,
  createSocialIconsBlock,
  createSpacerBlock,
} from "@templatical/types"
import { DEFAULT_BRAND } from "../brand"
import { PLACEHOLDER_IMAGE } from "../types"

export const NAVY = DEFAULT_BRAND.colors.navy
export const ORANGE = DEFAULT_BRAND.colors.orange
export const CREAM = DEFAULT_BRAND.colors.cream
export const MUTED = DEFAULT_BRAND.colors.muted
export const HEAD = DEFAULT_BRAND.fonts.heading
export const BODY = DEFAULT_BRAND.fonts.body

export const preheader = () =>
  createParagraphBlock({
    content: `<p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0">View this email in your browser · ${DEFAULT_BRAND.companyName}</p>`,
  })

export const logoBlock = () => {
  const b = createImageBlock({
    src: PLACEHOLDER_IMAGE,
    alt: `${DEFAULT_BRAND.companyName} logo`,
    width: 160,
  })
  b.styles = {
    padding: { top: 20, right: 0, bottom: 8, left: 0 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  }
  return b
}

export const brandedFooter = () => [
  createDividerBlock({ color: DEFAULT_BRAND.colors.divider, thickness: 1 }),
  createSocialIconsBlock({
    iconStyle: "circle",
    iconSize: "medium",
    icons: [
      {
        id: crypto.randomUUID(),
        platform: "facebook",
        url: DEFAULT_BRAND.socials.facebook ?? "https://",
      },
      {
        id: crypto.randomUUID(),
        platform: "instagram",
        url: DEFAULT_BRAND.socials.instagram ?? "https://",
      },
      {
        id: crypto.randomUUID(),
        platform: "youtube",
        url: DEFAULT_BRAND.socials.youtube ?? "https://",
      },
    ],
  }),
  createParagraphBlock({
    content: `<p style="color:${DEFAULT_BRAND.colors.muted};font-size:12px;text-align:center;line-height:1.6;margin:0">${DEFAULT_BRAND.companyName}<br/>${DEFAULT_BRAND.tagline}<br/>${DEFAULT_BRAND.address}</p>`,
  }),
  createSpacerBlock({ height: 16 }),
]
