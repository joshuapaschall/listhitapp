import { createDefaultTemplateContent } from "@templatical/types"
import type { TemplateContent } from "@templatical/editor"
import basicCta from "./basic/cta"
import basicImageText from "./basic/image-text"
import basicOneTwo from "./basic/one-two"
import basicSingle from "./basic/single"
import basicTextOnly from "./basic/text-only"
import basicTwoOne from "./basic/two-one"
import buyerReengagement from "./fully-designed/buyer-reengagement"
import cashBuyerWelcome from "./fully-designed/cash-buyer-welcome"
import justSold from "./fully-designed/just-sold"
import newInvestmentProperty from "./fully-designed/new-investment-property"
import newListing from "./fully-designed/new-listing"
import priceDropAlert from "./fully-designed/price-drop-alert"
import propertyTourRsvp from "./fully-designed/property-tour-rsvp"
import weeklyDealDigest from "./fully-designed/weekly-deal-digest"
import { PLACEHOLDER_IMAGE } from "./types"

export const BASIC_TEMPLATES = [basicSingle, basicOneTwo, basicTwoOne, basicImageText, basicTextOnly, basicCta]
export const FULLY_DESIGNED_TEMPLATES = [newInvestmentProperty, newListing, cashBuyerWelcome, weeklyDealDigest, priceDropAlert, propertyTourRsvp, justSold, buyerReengagement]
export const ALL_EMAIL_TEMPLATES = [...BASIC_TEMPLATES, ...FULLY_DESIGNED_TEMPLATES]

export function getEmailTemplate(id: string) {
  return ALL_EMAIL_TEMPLATES.find((template) => template.id === id)
}

export function emptyEmailTemplate(): TemplateContent {
  return createDefaultTemplateContent("Inter, Helvetica, Arial, sans-serif")
}

export type { EmailTemplateBucket, EmailTemplateCategory, EmailTemplateDef } from "./types"
export { PLACEHOLDER_IMAGE }
