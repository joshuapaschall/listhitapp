import { createButtonBlock, createDefaultTemplateContent, createImageBlock, createParagraphBlock, createSectionBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { PLACEHOLDER_IMAGE } from "../types"
import { BODY, brandedFooter, withPreheader } from "../fully-designed/shared"

const def: EmailTemplateDef = { id: "basic-1-2", name: "1:2 column", description: "A compact image column paired with a wider content column.", bucket: "basic", category: "Layout", wireframeVariant: "two-thirds-right", build: () => { const c = createDefaultTemplateContent(BODY); c.blocks = [createTitleBlock({ content: "Spotlight a deal quickly", level: 2 }), createSectionBlock({ columns: "1-2", children: [[createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with property thumbnail", width: "full" })], [createParagraphBlock({ content: "<p>Lead with key numbers: ask, ARV, repairs, and projected rent. Keep this concise so buyers can decide in under a minute.</p>" }), createButtonBlock({ text: "See full packet", url: "{{contact_form_link}}", backgroundColor: "#111827", textColor: "#ffffff", borderRadius: 6 })]] }), ...brandedFooter()]; return withPreheader(c, "A quick update from the team.") } }
export default def
