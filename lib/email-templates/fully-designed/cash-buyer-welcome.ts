import {
  createButtonBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
} from "@templatical/types"
import { DEFAULT_BRAND } from "../brand"
import type { EmailTemplateDef } from "../types"
import {
  BODY,
  CREAM,
  HEAD,
  NAVY,
  ORANGE,
  brandedFooter,
  logoBlock,
  withPreheader,
} from "./shared"

const def: EmailTemplateDef = {
  id: "cash-buyer-welcome",
  name: "Cash buyer welcome",
  description: "Introduce your buyers list and set expectations.",
  bucket: "fully-designed",
  category: "Welcome",
  previewImage: "/email-templates/previews/cash-buyer-welcome.svg",
  defaultSubject: "Welcome aboard, {{first_name}} — here is how our list works",
  build: () => {
    const c = createDefaultTemplateContent(BODY, {
      width: 600,
      backgroundColor: CREAM,
    })

    c.blocks = [
      logoBlock(),
      createTitleBlock({
        content: `<span style="font-family:${HEAD}">Welcome aboard, {{first_name}}</span>`,
        level: 1,
        textAlign: "center",
        color: NAVY,
      }),
      createParagraphBlock({
        content: `<p>Thanks for joining ${DEFAULT_BRAND.companyName}. You are now on our active cash buyer list and will receive deal alerts with clear numbers, timelines, and walkthrough instructions.</p>`,
      }),
      createTitleBlock({ content: "What we send", level: 3, color: NAVY }),
      createParagraphBlock({
        content:
          "<p>Expect off-market and value-add properties with asking price, ARV, estimated repairs, and rent comps so you can underwrite fast.</p>",
      }),
      createTitleBlock({
        content: "How fast you must move",
        level: 3,
        color: NAVY,
      }),
      createParagraphBlock({
        content:
          "<p>Our best opportunities are often claimed within hours. If a deal fits, reply right away and include proof of funds to secure priority.</p>",
      }),
      createTitleBlock({
        content: "How to set your buy box",
        level: 3,
        color: NAVY,
      }),
      createParagraphBlock({
        content:
          "<p>Tell us your target zip codes, budget range, property type, and minimum spread so we only send what matches your criteria.</p>",
      }),
      createButtonBlock({
        text: "Set your buy box",
        url: "{{contact_form_link}}",
        backgroundColor: ORANGE,
        textColor: "#fff",
        borderRadius: 6,
      }),
      createParagraphBlock({
        content:
          "<p>Questions before your first deal? Reply to this email and {{my_first_name}} {{my_last_name}} will help you get dialed in.</p>",
      }),
      ...brandedFooter(),
    ]

    return withPreheader(c, "Welcome — here's how our deal flow works.")
  },
}

export default def
