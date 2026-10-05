// Tag names the application code hard-codes, so they must exist in every org
// and can never be renamed or deleted. Recoloring is fine.
//
// Applied by the website-signup path via lib/buyer-taxonomy.ts
// (PERSONA_BASE_TAGS, BUYER_TYPE_MAP, PAYMENT_MAP). If a signup could produce a
// name that isn't here, that lead would land with a tag the vocabulary doesn't
// contain — so the two have to stay in step.
//
// MUST stay identical to:
//   - the ARRAY[...] literal in supabase/migrations/20261005000002_tags_management.sql
//   - the names used in lib/buyer-taxonomy.ts
// tests/system-tags-parity.test.ts enforces both.

export const SYSTEM_TAGS = [
  "Agent",
  "Buy and Hold",
  "Cash Buyer",
  "Commercial",
  "Creative Finance",
  "Developer/Home Builder",
  "First-time Buyer",
  "Fix and Flips",
  "Fixer Upper",
  "Hard Money",
  "Investor",
  "Land Development",
  "Landlord",
  "New Construction",
  "Owner Financing",
  "Realtor",
  "Rent to Own",
  "Retail Buyer",
  "SUB2",
  "Wholesaler",
] as const satisfies readonly string[]

const SYSTEM_TAG_SET = new Set<string>(SYSTEM_TAGS)

export function isSystemTag(name: string | null | undefined): boolean {
  if (!name) return false
  return SYSTEM_TAG_SET.has(name)
}
