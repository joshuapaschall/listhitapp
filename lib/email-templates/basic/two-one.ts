import { createButtonBlock, createDefaultTemplateContent, createImageBlock, createParagraphBlock, createSectionBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { PLACEHOLDER_IMAGE } from "../types"
import { BODY, brandedFooter, withPreheader } from "../fully-designed/shared"

const def: EmailTemplateDef = { id: "basic-2-1", name: "2:1 column", description: "A wider content column with supporting image on the right.", bucket: "basic", category: "Layout", wireframeVariant: "two-thirds-left", build: () => { const c = createDefaultTemplateContent(BODY); c.blocks = [createTitleBlock({ content: "Lead with the numbers", level: 2 }), createSectionBlock({ columns: "2-1", children: [[createParagraphBlock({ content: "<p>Use this layout when copy carries the sale. Add neighborhood context, recent comps, and your suggested offer strategy.</p>" }), createButtonBlock({ text: "View details", url: "{{contact_form_link}}", backgroundColor: "#111827", textColor: "#ffffff", borderRadius: 6 })], [createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with supporting image", width: "full" })]] }), ...brandedFooter()]; return withPreheader(c, "A quick update from the team.") } }
export default def
