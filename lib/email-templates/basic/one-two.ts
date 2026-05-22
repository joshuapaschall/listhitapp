import { createButtonBlock, createDefaultTemplateContent, createImageBlock, createParagraphBlock, createSectionBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { PLACEHOLDER_IMAGE } from "../types"

const def: EmailTemplateDef = {
  id: "basic-1-2",
  name: "1:2 column",
  description: "A compact image column paired with a wider content column.",
  bucket: "basic",
  category: "Layout",
  wireframeVariant: "two-thirds-right",
  build: () => {
    const c = createDefaultTemplateContent("Inter, Helvetica, Arial, sans-serif")
    const section = createSectionBlock({
      columns: "1-2",
      children: [
        [createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Property thumbnail", width: "full" })],
        [
          createTitleBlock({ content: "<h2>Highlight the opportunity</h2>", level: 2 }),
          createParagraphBlock({ content: "<p>Use this space for details, terms, and key selling points.</p>" }),
        ],
      ],
    })
    c.blocks = [
      section,
      createButtonBlock({ text: "Learn more", url: "https://", backgroundColor: "#111827", textColor: "#ffffff", borderRadius: 6 }),
    ]
    return c
  },
}

export default def
