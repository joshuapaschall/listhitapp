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

const EMAIL_ASSET_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  ""
).replace(/\/+$/, "")

export const PLACEHOLDER_IMAGE = EMAIL_ASSET_ORIGIN
  ? `${EMAIL_ASSET_ORIGIN}/placeholder.jpg`
  : "/placeholder.jpg"
