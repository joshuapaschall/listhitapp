import { createButtonBlock, createDefaultTemplateContent, createParagraphBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"

const def: EmailTemplateDef = {
  id: "basic-single",
  name: "Single column",
  description: "A simple headline, body copy, and call-to-action button.",
  bucket: "basic",
  category: "Layout",
  wireframeVariant: "single",
  build: () => {
    const c = createDefaultTemplateContent("Inter, Helvetica, Arial, sans-serif")
    c.blocks = [
      createTitleBlock({ content: "<h1>Your next buyer update starts here</h1>", level: 1, textAlign: "left" }),
      createParagraphBlock({ content: "<p>Use this clean single-column layout to send a focused message to your list.</p>" }),
      createButtonBlock({ text: "Get started", url: "https://", backgroundColor: "#111827", textColor: "#ffffff", borderRadius: 6 }),
    ]
    return c
  },
}

export default def
