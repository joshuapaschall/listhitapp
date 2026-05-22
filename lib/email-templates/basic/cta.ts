import { createButtonBlock, createDefaultTemplateContent, createParagraphBlock, createSpacerBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"

const def: EmailTemplateDef = {
  id: "basic-cta",
  name: "Big CTA",
  description: "A short message centered on one prominent call-to-action.",
  bucket: "basic",
  category: "Layout",
  wireframeVariant: "cta",
  build: () => {
    const c = createDefaultTemplateContent("Inter, Helvetica, Arial, sans-serif")
    c.blocks = [
      createTitleBlock({ content: "<h2>Ready to review the latest deal?</h2>", level: 2, textAlign: "center" }),
      createParagraphBlock({ content: "<p style=\"text-align:center\">Tap below to open the full numbers.</p>" }),
      createButtonBlock({ text: "Open deal packet", url: "https://", backgroundColor: "#111827", textColor: "#ffffff", borderRadius: 10 }),
      createSpacerBlock({ height: 16 }),
    ]
    return c
  },
}

export default def
