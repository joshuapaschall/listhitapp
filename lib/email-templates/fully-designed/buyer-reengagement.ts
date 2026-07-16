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
const def: EmailTemplateDef = { id: "buyer-reengagement", name: "Buyer re-engagement", description: "Reconnect with inactive buyers and refresh their criteria.", bucket: "fully-designed", category: "Re-engagement", previewImage: "/email-templates/previews/buyer-reengagement.svg", defaultSubject: "Still in the market, {{first_name}}?", build: () => { const c = createDefaultTemplateContent(BODY, { width: 600, backgroundColor: CREAM }); c.blocks = [logoBlock(), createTitleBlock({ content: `<span style="font-family:${HEAD}">Still in the market, {{first_name}}?</span>`, level: 1, textAlign: "center", color: NAVY }), createParagraphBlock({ content: "<p>We have new inventory moving every week and want to send only what fits your current strategy. Take 30 seconds to refresh your criteria.</p>" }), createSectionBlock({ columns: "2-1", children: [[createParagraphBlock({ content: "<p>Tell us your updated zip codes, max purchase price, preferred property type, and rehab comfort level so we can tighten your alerts.</p>" })], [createButtonBlock({ text: "Update my criteria", url: "{{contact_form_link}}", backgroundColor: ORANGE, textColor: "#fff", borderRadius: 6 })]] }), createTitleBlock({ content: "Here's what you missed", level: 3, color: NAVY }), createSectionBlock({ columns: "1-2", children: [[createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with missed deal photo", width: "full" })], [createParagraphBlock({ content: "<p><strong>South Fulton 3/2</strong><br/>Contracted in 14 hours.<br/>Ask $205,000 · ARV $298,000.<br/>Add one short takeaway on why buyers moved quickly.</p>" })]] }), createParagraphBlock({ content: "<p>If now is not the right time, reply and tell us to pause your alerts. Otherwise we will keep sending opportunities that match your targets.</p>" }), ...brandedFooter()]; return withPreheader(c, "Still in the market? Refresh your criteria.") } }
export default def
