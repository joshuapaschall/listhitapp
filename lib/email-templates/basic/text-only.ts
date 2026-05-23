import { createDefaultTemplateContent, createParagraphBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { BODY, brandedFooter, preheader } from "../fully-designed/shared"

const def: EmailTemplateDef = { id: "basic-text-only", name: "Text only", description: "A minimal layout for plain-text style updates with clean formatting.", bucket: "basic", category: "Layout", wireframeVariant: "text-only", build: () => { const c = createDefaultTemplateContent(BODY); c.blocks = [preheader(), createTitleBlock({ content: "<h1>Quick market update</h1>", level: 1 }), createParagraphBlock({ content: "<p>Hi {{first_name}}, this text-first starter is ideal for concise updates, offer feedback requests, or criteria check-ins.</p>" }), createParagraphBlock({ content: "<p>Sample prompt: reply with your top two target zip codes and the maximum rehab budget you are comfortable taking on this month.</p>" }), ...brandedFooter()]; return c } }
export default def
