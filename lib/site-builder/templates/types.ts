import type { Data } from "@measured/puck"
import type { SitePersona, SiteTemplateId, SiteTheme } from "../types"

export interface SiteTemplateDef {
  id: SiteTemplateId
  name: string
  description: string
  defaultTheme: Partial<SiteTheme> // e.g. marquee -> { headerLayout: "split" }
  heroVariant: "photo" | "centered" | "split" | "band"
  build: (persona: SitePersona) => Data // composes blocks via PERSONAS[persona]
}
