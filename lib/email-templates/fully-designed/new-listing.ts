import { createButtonBlock, createDefaultTemplateContent, createImageBlock, createParagraphBlock, createSectionBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { PLACEHOLDER_IMAGE } from "../types"
import { BODY, CREAM, HEAD, NAVY, ORANGE, brandedFooter, logoBlock, withPreheader } from "./shared"

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
const def: EmailTemplateDef = { id: "new-listing", name: "New listing", description: "Highlight a fresh listing with key details and a tour CTA.", bucket: "fully-designed", category: "Listing", previewImage: "/email-templates/previews/new-listing.svg", defaultSubject: "New listing match for you, {{first_name}}", build: () => { const c = createDefaultTemplateContent(BODY, { width: 600, backgroundColor: CREAM }); c.blocks = [logoBlock(), createTitleBlock({ content: `<span style="font-family:${HEAD}">New Listing</span>`, level: 1, textAlign: "center", color: NAVY }), createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with listing hero photo", width: "full" }), createParagraphBlock({ content: "<p>Hi {{first_name}}, this listing just opened up and lines up with buyer demand in this pocket. Swap in your property highlights and any financing notes buyers should know before touring.</p>" }), createSectionBlock({ columns: "1-2", children: [[createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with kitchen or living room photo", width: "full" })], [createParagraphBlock({ content: "<p><strong>4 bed · 2 bath · 1,986 sqft</strong><br/>Built 1988 · Lot 0.24 acres<br/>Asking $289,000 · Est. ARV $372,000<br/>Add school zone and HOA notes here.</p>" })]] }), createButtonBlock({ text: "Book a tour", url: "{{contact_form_link}}", backgroundColor: ORANGE, textColor: "#fff", borderRadius: 6 }), createParagraphBlock({ content: "<p><strong>Why this one:</strong> strong neighborhood turnover, updated roof, and proven rental demand from nearby employers.</p>" }), createParagraphBlock({ content: "<p><strong>Neighborhood map placeholder:</strong> Add distance to highways, retail, and recent comps within a half-mile radius.</p>" }), ...brandedFooter()]; return withPreheader(c, "A new listing that matches your buy box.") } }
export default def
