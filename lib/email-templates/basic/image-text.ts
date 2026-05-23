import { createButtonBlock, createDefaultTemplateContent, createImageBlock, createParagraphBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { PLACEHOLDER_IMAGE } from "../types"
import { BODY, brandedFooter, preheader } from "../fully-designed/shared"

const def: EmailTemplateDef = { id: "basic-image-text", name: "Image + text", bucket: "basic", category: "Layout", wireframeVariant: "image-text", description: "A hero image above a headline, paragraph, and button.", build: () => { const c = createDefaultTemplateContent(BODY); c.settings.backgroundColor = "#ffffff"; c.settings.width = 600; c.blocks = [preheader(), createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with hero property photo", width: "full" }), createTitleBlock({ content: "<h1>Highlight one strong opportunity</h1>", level: 1, textAlign: "center" }), createParagraphBlock({ content: "<p>Share the quick thesis, expected upside, and timeline so your buyers know why this one deserves attention.</p>" }), createButtonBlock({ text: "Open property details", url: "https://", backgroundColor: "#111827", textColor: "#ffffff", borderRadius: 6 }), ...brandedFooter()]; return c } }
export default def
