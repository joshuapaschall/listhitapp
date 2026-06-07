import type { SiteTemplateId } from "../types"
import type { SiteTemplateDef } from "./types"
import { aspen } from "./aspen"
import { cedar } from "./cedar"
import { madrone } from "./madrone"
import { oak } from "./oak"

export const ALL_SITE_TEMPLATES: SiteTemplateDef[] = [aspen, cedar, madrone, oak]

export function getSiteTemplate(id: SiteTemplateId): SiteTemplateDef | undefined {
  return ALL_SITE_TEMPLATES.find((t) => t.id === id)
}

export { PERSONAS, getPersona } from "./personas"
export type { SiteTemplateDef } from "./types"
export type { SitePersona, SiteTemplateId, SiteTheme, PersonaContent, HeaderLayout } from "../types"
