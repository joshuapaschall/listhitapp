import { createButtonBlock, createDefaultTemplateContent, createDividerBlock, createImageBlock, createParagraphBlock, createSectionBlock, createTitleBlock } from "@templatical/types"
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
const listingCard = (n: number) => createSectionBlock({ columns: "1-2", children: [[createImageBlock({ src: PLACEHOLDER_IMAGE, alt: `Replace with deal ${n} photo`, width: "full" })], [createTitleBlock({ content: `<h3>Deal ${n}: Add city + strategy</h3>`, level: 3, color: NAVY }), createParagraphBlock({ content: "<p>Sample: 3/2 brick ranch in Decatur. Ask $212,000, ARV $315,000, light cosmetic rehab. Replace with your true numbers and timeline.</p>" }), createButtonBlock({ text: "See numbers", url: "https://", backgroundColor: ORANGE, textColor: "#fff", borderRadius: 6 })]] })

const def: EmailTemplateDef = { id: "weekly-deal-digest", name: "Weekly deal digest", description: "Share multiple active opportunities in one weekly send.", bucket: "fully-designed", category: "Newsletter", previewImage: "/email-templates/previews/weekly-deal-digest.svg", defaultSubject: "This week's deals are in, {{first_name}}", build: () => { const c = createDefaultTemplateContent(BODY, { width: 600, backgroundColor: CREAM }); c.blocks = [preheader(), logoBlock(), createTitleBlock({ content: `<h1 style="font-family:${HEAD}">This Week's Deals</h1>`, level: 1, textAlign: "center", color: NAVY }), createParagraphBlock({ content: "<p>Hi {{first_name}}, here are three active opportunities from this week. Use this section to summarize what changed since last send and where buyers should focus.</p>" }), listingCard(1), createDividerBlock({ color: "#E5E7EB", thickness: 1 }), listingCard(2), createDividerBlock({ color: "#E5E7EB", thickness: 1 }), listingCard(3), createParagraphBlock({ content: "<p style=\"text-align:center\">More inventory is coming next week. Reply with your preferred zip codes so we can prioritize your matches.</p>" }), ...brandedFooter()]; return c } }
export default def
