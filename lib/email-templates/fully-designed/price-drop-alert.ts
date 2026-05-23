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
const def: EmailTemplateDef = { id: "price-drop-alert", name: "Price drop alert", description: "Notify buyers when a watched property drops in price.", bucket: "fully-designed", category: "Alert", previewImage: "/email-templates/previews/price-drop-alert.svg", defaultSubject: "Price reduced: updated spread inside", build: () => { const c = createDefaultTemplateContent(BODY, { width: 600, backgroundColor: CREAM }); const bar = createSectionBlock({ columns: "1", children: [[createTitleBlock({ content: "<h3 style=\"color:#ffffff;margin:0\">PRICE DROP</h3>", level: 3, textAlign: "center" })]] }); bar.styles = { backgroundColor: ORANGE, padding: { top: 12, right: 12, bottom: 12, left: 12 }, margin: { top: 0, right: 0, bottom: 8, left: 0 } }; c.blocks = [preheader(), bar, logoBlock(), createTitleBlock({ content: `<h1 style="font-family:${HEAD}">Price Reduced</h1>`, level: 1, textAlign: "center", color: NAVY }), createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with updated property photo", width: "full" }), createParagraphBlock({ content: "<p>Hi {{first_name}}, this property just got a meaningful adjustment. Old ask <strong>$265,000</strong> → new ask <strong>$244,000</strong>. Update your model and confirm if you want first position.</p>" }), createSectionBlock({ columns: "2-1", children: [[createParagraphBlock({ content: "<p><strong>Updated deal notes</strong><br/>Repair estimate unchanged at $42,000<br/>Projected rent $2,250/mo<br/>Estimated spread widened by $21,000</p>" })], [createImageBlock({ src: PLACEHOLDER_IMAGE, alt: "Replace with comp image", width: "full" })]] }), createButtonBlock({ text: "See updated numbers", url: "https://", backgroundColor: ORANGE, textColor: "#fff", borderRadius: 6 }), createParagraphBlock({ content: "<p style=\"text-align:center\">Inventory this tight rarely sits. If this still fits your criteria, reply now so we can hold your spot.</p>" }), ...brandedFooter()]; return c } }
export default def
