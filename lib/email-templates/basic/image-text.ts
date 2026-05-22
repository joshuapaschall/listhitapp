import {
  createButtonBlock,
  createDefaultTemplateContent,
  createImageBlock,
  createParagraphBlock,
  createTitleBlock,
} from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { PLACEHOLDER_IMAGE } from "../types"

const def: EmailTemplateDef = {
  id: "basic-image-text",
  name: "Image + text",
  bucket: "basic",
  category: "Layout",
  wireframeVariant: "image-text",
  description: "A hero image above a headline, paragraph, and button.",
  build: () => {
    const c = createDefaultTemplateContent("Inter, Helvetica, Arial, sans-serif")
    c.settings.backgroundColor = "#ffffff"
    c.settings.width = 600
    c.blocks = [
      createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Hero image", width: "full" }),
      createTitleBlock({ content: "<h1>It's time to design your email</h1>", level: 1, textAlign: "center" }),
      createParagraphBlock({ content: "<p>Add, rearrange, and delete content blocks to shape your message.</p>" }),
      createButtonBlock({ text: "Call to action", url: "https://", backgroundColor: "#111827", textColor: "#ffffff", borderRadius: 6 }),
    ]
    return c
  },
}

export default def
