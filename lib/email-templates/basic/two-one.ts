import { createButtonBlock, createDefaultTemplateContent, createImageBlock, createParagraphBlock, createSectionBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { PLACEHOLDER_IMAGE } from "../types"

const def: EmailTemplateDef = {
  id: "basic-2-1",
  name: "2:1 column",
  description: "A wider content column with supporting image on the right.",
  bucket: "basic",
  category: "Layout",
  wireframeVariant: "two-thirds-left",
  build: () => {
    const c = createDefaultTemplateContent("Inter, Helvetica, Arial, sans-serif")
    const section = createSectionBlock({
      columns: "2-1",
      children: [
        [
          createTitleBlock({ content: "<h2>Lead with your message</h2>", level: 2 }),
          createParagraphBlock({ content: "<p>Summarize the deal details and urgency in this larger text area.</p>" }),
          createButtonBlock({ text: "View details", url: "https://", backgroundColor: "#111827", textColor: "#ffffff", borderRadius: 6 }),
        ],
        [createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Investment property side photo", width: "full" })],
      ],
    })
    c.blocks = [section]
    return c
  },
}

export default def
