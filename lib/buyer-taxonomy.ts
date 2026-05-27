import { PROPERTY_TYPES } from "@/lib/constant"
import { mergeUnique } from "@/lib/dedup-utils"

export { PROPERTY_TYPES }

export type BuyerTypeKey = "fix_flip" | "buy_hold" | "first_time" | "developer" | "wholesaler" | "realtor"
export type PaymentKey = "cash" | "hard_money" | "creative_finance"

type Derivation = { tags: string[]; investor?: boolean; cash_buyer?: boolean; owner_financing?: boolean; first_time_buyer?: boolean }

export const BUYER_TYPE_MAP: Record<BuyerTypeKey, Derivation> = {
  fix_flip: { tags: ["Fix and Flips", "Investor", "Fixer Upper"], investor: true },
  buy_hold: { tags: ["Buy and Hold", "Investor", "Landlord"], investor: true },
  first_time: { tags: ["First-time Buyer", "Retail Buyer"], first_time_buyer: true },
  developer: { tags: ["Developer/Home Builder", "Investor", "Land Development", "New Construction"], investor: true },
  wholesaler: { tags: ["Wholesaler"] },
  realtor: { tags: ["Realtor"] },
}

export const PAYMENT_MAP: Record<PaymentKey, Derivation> = {
  cash: { tags: ["Cash Buyer", "Investor"], cash_buyer: true, investor: true },
  hard_money: { tags: ["Hard Money", "Investor"], investor: true },
  creative_finance: { tags: ["Creative Finance", "Owner Financing", "SUB2"], owner_financing: true },
}

export function deriveProfile(buyerTypes: BuyerTypeKey[], payments: PaymentKey[]) {
  let tags: string[] = []
  let investor = false
  let cash_buyer = false
  let owner_financing = false
  let first_time_buyer = false

  for (const key of buyerTypes) {
    const d = BUYER_TYPE_MAP[key]
    if (!d) continue
    tags = mergeUnique(tags, d.tags) ?? []
    investor = investor || d.investor === true
    cash_buyer = cash_buyer || d.cash_buyer === true
    owner_financing = owner_financing || d.owner_financing === true
    first_time_buyer = first_time_buyer || d.first_time_buyer === true
  }

  for (const key of payments) {
    const d = PAYMENT_MAP[key]
    if (!d) continue
    tags = mergeUnique(tags, d.tags) ?? []
    investor = investor || d.investor === true
    cash_buyer = cash_buyer || d.cash_buyer === true
    owner_financing = owner_financing || d.owner_financing === true
    first_time_buyer = first_time_buyer || d.first_time_buyer === true
  }

  return { tags, investor, cash_buyer, owner_financing, first_time_buyer }
}

export function sanitizeLocations(locs: string[] | undefined): string[] {
  if (!Array.isArray(locs)) return []
  return locs.filter((loc) => typeof loc === "string" && (loc.endsWith("(GA)") || loc === "GA, USA"))
}

export function sanitizePropertyTypes(pts: string[] | undefined): string[] {
  if (!Array.isArray(pts)) return []
  return pts.filter((pt): pt is string => PROPERTY_TYPES.includes(pt))
}
