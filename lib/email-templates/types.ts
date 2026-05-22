import type { TemplateContent } from "@templatical/editor"

export type EmailTemplateBucket = "basic" | "fully-designed"

export type EmailTemplateCategory =
  | "Layout"
  | "Deal blast"
  | "Listing"
  | "Welcome"
  | "Newsletter"
  | "Alert"
  | "Event"
  | "Social proof"
  | "Re-engagement"

export interface EmailTemplateDef {
  id: string
  name: string
  description: string
  bucket: EmailTemplateBucket
  category: EmailTemplateCategory
  wireframeVariant?: string
  previewImage?: string
  defaultSubject?: string
  build: () => TemplateContent
}

export const PLACEHOLDER_IMAGE = "/placeholder.jpg"
