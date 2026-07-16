import { createButtonBlock, createDefaultTemplateContent, createImageBlock, createParagraphBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { PLACEHOLDER_IMAGE } from "../types"
import { BODY, brandedFooter, withPreheader } from "../fully-designed/shared"

const def: EmailTemplateDef = { id: "basic-image-text", name: "Image + text", bucket: "basic", category: "Layout", wireframeVariant: "image-text", description: "A hero image above a headline, paragraph, and button.", build: () => { const c = createDefaultTemplateContent(BODY); c.settings.backgroundColor = "#ffffff"; c.settings.width = 600; c.blocks = [createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with hero property photo", width: "full" }), createTitleBlock({ content: "Highlight one strong opportunity", level: 1, textAlign: "center" }), createParagraphBlock({ content: "<p>Share the quick thesis, expected upside, and timeline so your buyers know why this one deserves attention.</p>" }), createButtonBlock({ text: "Open property details", url: "{{contact_form_link}}", backgroundColor: "#111827", textColor: "#ffffff", borderRadius: 6 }), ...brandedFooter()]; return withPreheader(c, "One opportunity worth a look.") } }
export default def
