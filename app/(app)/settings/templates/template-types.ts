import type { TemplateType } from "@/lib/supabase"

export type TemplateSlug = "sms" | "email" | "quick-reply"

export const templateTypeConfig: Record<TemplateSlug, {
  type: TemplateType
  label: string
  description: string
  cta: string
  singular: string
}> = {
  sms: {
    type: "sms",
    label: "SMS Templates",
    description: "Reusable SMS scripts for one-off texts or campaigns",
    cta: "New SMS Template",
    singular: "SMS Template",
  },
  email: {
    type: "email",
    label: "Email Templates",
    description: "Saved email bodies for outreach and follow-ups",
    cta: "New Email Template",
    singular: "Email Template",
  },
  "quick-reply": {
    type: "quick_reply",
    label: "Quick Replies",
    description: "Short responses you can drop into chats fast",
    cta: "New Quick Reply",
    singular: "Quick Reply",
  },
}

export const templateNav = [
  { label: "SMS", href: "/settings/templates/sms" },
  { label: "Email", href: "/settings/templates/email" },
  { label: "Quick Replies", href: "/settings/templates/quick-reply" },
]
