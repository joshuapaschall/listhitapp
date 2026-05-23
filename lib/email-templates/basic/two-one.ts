import { createButtonBlock, createDefaultTemplateContent, createImageBlock, createParagraphBlock, createSectionBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { PLACEHOLDER_IMAGE } from "../types"
import { BODY, brandedFooter, preheader } from "../fully-designed/shared"

const def: EmailTemplateDef = { id: "basic-2-1", name: "2:1 column", description: "A wider content column with supporting image on the right.", bucket: "basic", category: "Layout", wireframeVariant: "two-thirds-left", build: () => { const c = createDefaultTemplateContent(BODY); c.blocks = [preheader(), createTitleBlock({ content: "<h2>Lead with the numbers</h2>", level: 2 }), createSectionBlock({ columns: "2-1", children: [[createParagraphBlock({ content: "<p>Use this layout when copy carries the sale. Add neighborhood context, recent comps, and your suggested offer strategy.</p>" }), createButtonBlock({ text: "View details", url: "https://", backgroundColor: "#111827", textColor: "#ffffff", borderRadius: 6 })], [createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with supporting image", width: "full" })]] }), ...brandedFooter()]; return c } }
export default def
