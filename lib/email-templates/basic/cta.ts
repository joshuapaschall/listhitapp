import { createButtonBlock, createDefaultTemplateContent, createParagraphBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { BODY, brandedFooter, preheader } from "../fully-designed/shared"

const def: EmailTemplateDef = { id: "basic-cta", name: "Big CTA", description: "A short message centered on one prominent call-to-action.", bucket: "basic", category: "Layout", wireframeVariant: "cta", build: () => { const c = createDefaultTemplateContent(BODY); c.blocks = [preheader(), createTitleBlock({ content: "<h2>Ready to review the latest deal?</h2>", level: 2, textAlign: "center" }), createParagraphBlock({ content: "<p style=\"text-align:center\">Use this layout when speed matters. Keep copy short and drive buyers to one next action.</p>" }), createButtonBlock({ text: "Open the deal packet", url: "https://", backgroundColor: "#111827", textColor: "#ffffff", borderRadius: 10 }), createParagraphBlock({ content: "<p style=\"text-align:center\">Need custom numbers first? Reply and our team will send underwriting notes.</p>" }), ...brandedFooter()]; return c } }
export default def
