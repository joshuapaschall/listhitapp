import { createDividerBlock, createImageBlock, createParagraphBlock, createSocialIconsBlock, createSpacerBlock } from "@templatical/types"
import { PLACEHOLDER_IMAGE } from "../types"

export const NAVY = "#1E3A8A"
export const ORANGE = "#F97316"
export const CREAM = "#F9F7F1"
export const MUTED = "#6B7280"
export const HEAD = "Playfair Display, Georgia, serif"
export const BODY = "Inter, Helvetica, Arial, sans-serif"

export const preheader = () =>
  createParagraphBlock({ content: `<p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0">View this email in your browser · GA Wholesale Homes</p>` })

export const logoBlock = () => {
  const b = createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "GA Wholesale Homes logo", width: 160 })
  b.styles = { padding: { top: 20, right: 0, bottom: 8, left: 0 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } }
  return b
}

export const brandedFooter = () => [
  createDividerBlock({ color: "#E5E7EB", thickness: 1 }),
  createSocialIconsBlock({ iconStyle: "circle", iconSize: "medium", icons: [
    { id: crypto.randomUUID(), platform: "facebook", url: "https://" },
    { id: crypto.randomUUID(), platform: "instagram", url: "https://" },
    { id: crypto.randomUUID(), platform: "youtube", url: "https://" },
  ] }),
  createParagraphBlock({ content: `<p style="color:${MUTED};font-size:12px;text-align:center;line-height:1.6;margin:0">GA Wholesale Homes<br/>Real estate deals for serious buyers<br/>[Your business address]</p>` }),
  createSpacerBlock({ height: 16 }),
]
