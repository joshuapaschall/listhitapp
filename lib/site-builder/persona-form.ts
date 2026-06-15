import type { BuyerTypeKey, PaymentKey } from "@/lib/buyer-taxonomy"
import { PROPERTY_TYPES } from "@/lib/constant"
import type { SitePersona } from "./types"

export const BUYER_TYPE_OPTIONS: { key: BuyerTypeKey; label: string }[] = [
  { key: "fix_flip", label: "Fix & flip" },
  { key: "buy_hold", label: "Buy & hold / rentals" },
  { key: "developer", label: "Developer / builder" },
  { key: "first_time", label: "First-time buyer" },
  { key: "wholesaler", label: "Wholesaler" },
  { key: "realtor", label: "Agent / realtor" },
]
export const PAYMENT_OPTIONS: { key: PaymentKey; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "hard_money", label: "Hard money" },
  { key: "creative_finance", label: "Creative / owner finance" },
]
export const PRICE_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: "Under $150k", max: 150000 },
  { label: "$150k – $300k", min: 150000, max: 300000 },
  { label: "$300k – $500k", min: 300000, max: 500000 },
  { label: "$500k+", min: 500000 },
]

export interface PersonaFormConfig {
  showBuyerTypes: boolean
  buyerTypeKeys: BuyerTypeKey[]      // subset to show (when showBuyerTypes)
  showPayments: boolean
  paymentKeys: PaymentKey[]
  propertyTypes: string[]            // whitelist; empty = all PROPERTY_TYPES
  buyerTypeQuestion: string
}

const ALL_BT: BuyerTypeKey[] = ["fix_flip", "buy_hold", "developer", "first_time", "wholesaler", "realtor"]
const ALL_PAY: PaymentKey[] = ["cash", "hard_money", "creative_finance"]

export const PERSONA_FORM_CONFIG: Record<SitePersona, PersonaFormConfig> = {
  cash:       { showBuyerTypes: true,  buyerTypeKeys: ALL_BT, showPayments: true,  paymentKeys: ALL_PAY, propertyTypes: [], buyerTypeQuestion: "What kind of buyer are you?" },
  investor:   { showBuyerTypes: true,  buyerTypeKeys: ["fix_flip","buy_hold","developer"], showPayments: true, paymentKeys: ALL_PAY, propertyTypes: [], buyerTypeQuestion: "What's your strategy?" },
  rto:        { showBuyerTypes: false, buyerTypeKeys: [], showPayments: false, paymentKeys: [], propertyTypes: ["Single Family","Townhouse","Condo"], buyerTypeQuestion: "" },
  owner:      { showBuyerTypes: true,  buyerTypeKeys: ["fix_flip","buy_hold","first_time"], showPayments: false, paymentKeys: [], propertyTypes: [], buyerTypeQuestion: "How will you use the property?" },
  creative:   { showBuyerTypes: true,  buyerTypeKeys: ["fix_flip","buy_hold"], showPayments: false, paymentKeys: [], propertyTypes: [], buyerTypeQuestion: "What's your strategy?" },
  land:       { showBuyerTypes: true,  buyerTypeKeys: ["developer","buy_hold"], showPayments: true,  paymentKeys: ["cash","hard_money","creative_finance"], propertyTypes: ["Land"], buyerTypeQuestion: "What kind of land buyer are you?" },
  commercial: { showBuyerTypes: true,  buyerTypeKeys: ["buy_hold","developer"], showPayments: true, paymentKeys: ["cash","hard_money"], propertyTypes: ["Commercial","Office","Retail","Industrial","Mixed-Use","Multi-Family"], buyerTypeQuestion: "What do you invest in?" },
  agent:      { showBuyerTypes: true,  buyerTypeKeys: ALL_BT, showPayments: true,  paymentKeys: ALL_PAY, propertyTypes: [], buyerTypeQuestion: "What kind of buyer are you?" },
}

export function getPersonaForm(persona: SitePersona): PersonaFormConfig {
  return PERSONA_FORM_CONFIG[persona] || PERSONA_FORM_CONFIG.cash
}
export function propertyTypeChoices(cfg: PersonaFormConfig): string[] {
  return cfg.propertyTypes.length ? cfg.propertyTypes : PROPERTY_TYPES
}
