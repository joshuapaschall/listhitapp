import { createButtonBlock, createDefaultTemplateContent, createDividerBlock, createImageBlock, createParagraphBlock, createSocialIconsBlock, createSpacerBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { PLACEHOLDER_IMAGE } from "../types"

const NAVY = "#1E3A8A"
const ORANGE = "#F97316"
const CREAM = "#F9F7F1"
const MUTED = "#6B7280"
const HEAD = "Playfair Display, Georgia, serif"
const BODY = "Inter, Helvetica, Arial, sans-serif"

const def: EmailTemplateDef = {
  id: "new-investment-property",
  name: "New investment property",
  bucket: "fully-designed",
  category: "Deal blast",
  description: "Announce a new off-market deal to your cash buyers.",
  previewImage: "/email-templates/previews/new-investment-property.svg",
  defaultSubject: "🏠 New off-market deal — {{first_name}}, take a look",
  build: () => {
    const c = createDefaultTemplateContent(BODY, { width: 600, backgroundColor: CREAM })
    const logo = createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "GA Wholesale Homes logo", width: 160 })
    logo.styles = { padding: { top: 24, right: 0, bottom: 8, left: 0 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } }
    const h = createTitleBlock({ content: `<h1 style="font-family:${HEAD}">New Investment Property</h1>`, level: 1, textAlign: "center", color: NAVY })
    const hero = createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Exterior of investment property", width: "full" })
    const body = createParagraphBlock({ content: "<p>Hi {{first_name}}, we just secured a new off-market property. Below are the numbers — reply fast, these move quickly.</p>" })
    const cta = createButtonBlock({ text: "View the deal", url: "https://", backgroundColor: ORANGE, textColor: "#ffffff", borderRadius: 6 })
    const div = createDividerBlock({ color: "#E5E7EB", thickness: 1 })
    const social = createSocialIconsBlock({ iconStyle: "circle", iconSize: "medium", icons: [{ id: crypto.randomUUID(), platform: "facebook", url: "https://" }, { id: crypto.randomUUID(), platform: "instagram", url: "https://" }] })
    const footer = createParagraphBlock({ content: `<p style="color:${MUTED};font-size:12px;text-align:center">GA Wholesale Homes · You're receiving this because you opted in. <a href="{{unsubscribe}}">Unsubscribe</a></p>` })
    c.blocks = [logo, h, createSpacerBlock({ height: 8 }), hero, body, cta, div, social, footer]
    return c
  },
}

export default def
