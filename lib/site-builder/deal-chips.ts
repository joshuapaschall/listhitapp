// Shared, presentational helpers for deal chips used on the property detail page
// and the deal cards. The status colors below are semantic encodings for
// condition/occupancy (green/amber/coral/gray) — NOT brand color — so they're
// intentionally hardcoded hex.

const FINANCE_SUBTYPE_LABEL: Record<string, string> = {
  owner_finance: "Owner finance",
  subject_to: "Subject-to",
  land_contract: "Land contract",
}

// Friendly, buyer-facing terms label derived from deal_type/finance_subtype.
export function termsLabelFrom(dealType: string | null, financeSubtype: string | null): string {
  if (dealType === "creative") {
    return (financeSubtype && FINANCE_SUBTYPE_LABEL[financeSubtype]) || "Creative finance"
  }
  return "All cash"
}

// Semantic chip palette for condition/occupancy enum values. Returns null when
// there's no value to render.
export function chipStyle(value: string | null): { bg: string; fg: string } | null {
  if (!value) return null
  const v = value.toLowerCase()
  if (v === "turnkey" || v === "vacant") return { bg: "#E9F6EE", fg: "#1F7A44" }      // green
  if (v === "light rehab" || v === "tenant") return { bg: "#FDF1DA", fg: "#8A5A0B" }   // amber / blue-ish ok
  if (v === "full rehab") return { bg: "#FBEAE6", fg: "#9A3B1F" }                       // coral (NOT brand red)
  if (v === "owner-occupied") return { bg: "#F1EFE8", fg: "#444441" }                   // gray
  return { bg: "#EEF1F5", fg: "#42505f" }                                              // neutral fallback
}
