import { createDefaultTemplateContent, createParagraphBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { BODY, brandedFooter, withPreheader } from "../fully-designed/shared"

const def: EmailTemplateDef = { id: "basic-text-only", name: "Text only", description: "A minimal layout for plain-text style updates with clean formatting.", bucket: "basic", category: "Layout", wireframeVariant: "text-only", build: () => { const c = createDefaultTemplateContent(BODY); c.blocks = [createTitleBlock({ content: "Quick market update", level: 1 }), createParagraphBlock({ content: "<p>Hi {{first_name}}, this text-first starter is ideal for concise updates, offer feedback requests, or criteria check-ins.</p>" }), createParagraphBlock({ content: "<p>Sample prompt: reply with your top two target zip codes and the maximum rehab budget you are comfortable taking on this month.</p>" }), ...brandedFooter()]; return withPreheader(c, "A short note for you.") } }
export default def
