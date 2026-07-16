import { createButtonBlock, createDefaultTemplateContent, createImageBlock, createParagraphBlock, createSectionBlock, createSpacerBlock, createTitleBlock } from "@templatical/types"
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
const def: EmailTemplateDef = {
  id: "new-investment-property", name: "New investment property", bucket: "fully-designed", category: "Deal blast", description: "Announce a new off-market deal to your cash buyers.", previewImage: "/email-templates/previews/new-investment-property.svg", defaultSubject: "New off-market deal in your buy box, {{first_name}}",
  build: () => {
    const c = createDefaultTemplateContent(BODY, { width: 600, backgroundColor: CREAM })
    c.blocks = [logoBlock(), createTitleBlock({ content: `<span style="font-family:${HEAD}">New Investment Property</span>`, level: 1, textAlign: "center", color: NAVY }), createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with property hero photo", width: "full" }), createParagraphBlock({ content: "<p>Hi {{first_name}}, we just locked up a fresh off-market property that fits active rental and flip buyers. Replace this intro with your 1-2 sentence angle and neighborhood context.</p>" }), createSectionBlock({ columns: "2-1", children: [[createTitleBlock({ content: "Deal Snapshot", level: 3, color: NAVY }), createParagraphBlock({ content: "<p>ARV: $365,000<br/>Asking: $239,000<br/>Estimated Repairs: $48,000<br/>Est. Rent: $2,350/mo<br/>Add your cap rate and cash-on-cash notes here.</p>" })], [createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with comp or interior photo", width: "full" })]] }), createSpacerBlock({ height: 8 }), createButtonBlock({ text: "View the deal", url: "{{contact_form_link}}", backgroundColor: ORANGE, textColor: "#ffffff", borderRadius: 6 }), createParagraphBlock({ content: "<p style=\"text-align:center\">First qualified buyer to confirm wins this one. We are scheduling walkthrough calls today.</p>" }), createButtonBlock({ text: "Reply to claim", url: "{{contact_form_link}}", backgroundColor: "#1F2937", textColor: "#ffffff", borderRadius: 6 }), ...brandedFooter()]
    return withPreheader(c, "Fresh off-market property, numbers inside.")
  },
}
export default def
