import { createButtonBlock, createDefaultTemplateContent, createImageBlock, createParagraphBlock, createSectionBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { PLACEHOLDER_IMAGE } from "../types"
import { BODY, CREAM, HEAD, NAVY, ORANGE, brandedFooter, logoBlock, preheader } from "./shared"

// create
// create
// create
// create
// create
// create
// create
// create
// create
// create
// create
// create
const def: EmailTemplateDef = { id: "just-sold", name: "Just sold", description: "Share a recent closing to reinforce social proof.", bucket: "fully-designed", category: "Social proof", previewImage: "/email-templates/previews/just-sold.svg", defaultSubject: "Just sold: see how fast this one closed", build: () => { const c = createDefaultTemplateContent(BODY, { width: 600, backgroundColor: CREAM }); c.blocks = [preheader(), logoBlock(), createTitleBlock({ content: `<h1 style="font-family:${HEAD}">Just Sold</h1>`, level: 1, textAlign: "center", color: NAVY }), createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with recently sold property photo", width: "full" }), createParagraphBlock({ content: "<p>Hi {{first_name}}, this deal is officially closed. Sharing recent wins helps you benchmark timing, pricing, and execution standards for upcoming opportunities.</p>" }), createParagraphBlock({ content: `<p style="border-left:4px solid ${ORANGE};padding-left:12px;margin:0"><em>"Your numbers were clean, communication was fast, and we closed without surprises. I am ready for the next one."</em><br/>— Active cash buyer</p>` }), createSectionBlock({ columns: "2-1", children: [[createParagraphBlock({ content: "<p><strong>Deal Stats</strong><br/>Contract to close: 9 days<br/>Purchase: $231,000<br/>Exit value: $338,000<br/>Net spread target achieved</p>" })], [createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with before/after detail photo", width: "full" })]] }), createButtonBlock({ text: "Get the next one", url: "{{contact_form_link}}", backgroundColor: ORANGE, textColor: "#fff", borderRadius: 6 }), createParagraphBlock({ content: "<p style=\"text-align:center\">Reply with your buy box updates and we will prioritize similar inventory.</p>" }), ...brandedFooter()]; return c } }
export default def
