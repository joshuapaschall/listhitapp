import type { SiteTemplateId } from "../types"
import type { SiteTemplateDef } from "./types"
import { marquee } from "./marquee"
import { haven } from "./haven"
import { vantage } from "./vantage"
import { forge } from "./forge"

export const ALL_SITE_TEMPLATES: SiteTemplateDef[] = [marquee, haven, vantage, forge]

export function getSiteTemplate(id: SiteTemplateId): SiteTemplateDef | undefined {
  return ALL_SITE_TEMPLATES.find((t) => t.id === id)
}

export { PERSONAS, getPersona } from "./personas"
export type { SiteTemplateDef } from "./types"
export type { SitePersona, SiteTemplateId, SiteTheme, PersonaContent, HeaderLayout } from "../types"
