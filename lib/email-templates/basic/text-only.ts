import { createDefaultTemplateContent, createParagraphBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"

const def: EmailTemplateDef = {
  id: "basic-text-only",
  name: "Text only",
  description: "A minimal layout for plain-text style updates with clean formatting.",
  bucket: "basic",
  category: "Layout",
  wireframeVariant: "text-only",
  build: () => {
    const c = createDefaultTemplateContent("Inter, Helvetica, Arial, sans-serif")
    c.blocks = [
      createTitleBlock({ content: "<h1>Quick market update</h1>", level: 1 }),
      createParagraphBlock({ content: "<p>Send concise deal info or buyer updates with a distraction-free format.</p>" }),
      createParagraphBlock({ content: "<p>Hi {{first_name}}, reply to this email and let us know what properties you are targeting this week.</p>" }),
    ]
    return c
  },
}

export default def
