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
const def: EmailTemplateDef = { id: "property-tour-rsvp", name: "Property tour RSVP", description: "Invite buyers to a walkthrough event and collect RSVPs.", bucket: "fully-designed", category: "Event", previewImage: "/email-templates/previews/property-tour-rsvp.svg", defaultSubject: "Property walkthrough invite: RSVP today", build: () => { const c = createDefaultTemplateContent(BODY, { width: 600, backgroundColor: CREAM }); c.blocks = [preheader(), logoBlock(), createTitleBlock({ content: `<h1 style="font-family:${HEAD}">Property Walkthrough</h1>`, level: 1, textAlign: "center", color: NAVY }), createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with walkthrough property exterior", width: "full" }), createParagraphBlock({ content: "<p>Hi {{first_name}}, we are hosting a guided walkthrough so serious buyers can inspect condition, layout, and value-add opportunities before submitting offers.</p>" }), createSectionBlock({ columns: "1", children: [[createParagraphBlock({ content: "<p><strong>Date:</strong> [Add date]<br/><strong>Time:</strong> [Add time window]<br/><strong>Address:</strong> [Add full property address]</p>" })]] }), createButtonBlock({ text: "RSVP now", url: "{{contact_form_link}}", backgroundColor: ORANGE, textColor: "#fff", borderRadius: 6 }), createParagraphBlock({ content: "<p><strong>What to bring:</strong> proof of funds, contractor scope checklist, and your target offer range so we can answer numbers on-site.</p>" }), createParagraphBlock({ content: "<p style=\"text-align:center\">Questions before the tour? Reply here or call {{phone}} and we will help.</p>" }), ...brandedFooter()]; return c } }
export default def
