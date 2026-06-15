export const PROPERTY_TYPES = [
  "Commercial",
  "Condo",
  "Land",
  "Mobile/Manufactured",
  "Multi-Family",
  "Single Family",
  "Townhouse",
  "Office",
  "Retail",
  "Industrial",
  "Mixed-Use",
]

// Visual grouping for property-type dropdowns (Add Property, buyers filter,
// smart-group builder). Presentation only — property_type stays a single flat
// free-text value and the commercial asset classes are first-class types, not a
// separate subtype column. Every type listed here must also exist in
// PROPERTY_TYPES above, and every PROPERTY_TYPES entry must appear in exactly
// one group.
export const PROPERTY_TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: "Residential", types: ["Single Family", "Condo", "Townhouse", "Multi-Family", "Mobile/Manufactured"] },
  { label: "Commercial", types: ["Commercial", "Office", "Retail", "Industrial", "Mixed-Use"] },
  { label: "Land", types: ["Land"] },
]
