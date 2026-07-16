import { createButtonBlock, createDefaultTemplateContent, createParagraphBlock, createTitleBlock } from "@templatical/types"
import type { EmailTemplateDef } from "../types"
import { BODY, brandedFooter, withPreheader } from "../fully-designed/shared"

const def: EmailTemplateDef = {
  id: "basic-single", name: "Single column", description: "A simple headline, body copy, and call-to-action button.", bucket: "basic", category: "Layout", wireframeVariant: "single",
  build: () => { const c = createDefaultTemplateContent(BODY); c.blocks = [createTitleBlock({ content: "Weekly buyer update", level: 1, textAlign: "left" }), createParagraphBlock({ content: "<p>Hi {{first_name}}, use this flexible one-column layout for a focused market update or a single opportunity announcement.</p>" }), createParagraphBlock({ content: "<p>Replace this paragraph with your deal summary, timing notes, and any underwriting assumptions your buyers should review.</p>" }), createButtonBlock({ text: "Review this week's opportunity", url: "{{contact_form_link}}", backgroundColor: "#111827", textColor: "#ffffff", borderRadius: 6 }), ...brandedFooter()]; return withPreheader(c, "Your weekly buyer update is here.") },
}
export default def
