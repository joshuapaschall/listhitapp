// Faithful mapping from the Buyers-page FilterState to a SegmentDefinition.
// One implementation, reused by the Buyers list (Part 3) and the "save as
// segment" door (Part 4). Each field maps to the SAME predicate the page's
// fetchBuyers applies today (see the equivalence tests).
//
// Two fields are intentionally NOT part of a segment definition:
//   - search        → a transient text query, not an audience rule
//   - reachability   → can_receive_email/sms is an eligibility concern, applied
//                      automatically at send time by the shared eligibility gate
// Both are flagged so the UI can tell the user.

import type { AttributeCondition, SegmentDefinition } from "./types"

// Mirrors app/page.tsx FilterState exactly.
export interface BuyersFilterState {
  search: string
  selectedTags: string[]
  excludeTags: string[]
  selectedLocations: string[]
  minScore: string
  maxScore: string
  vip: string
  vetted: string
  canReceiveEmail: string
  canReceiveSMS: string
  createdAfter: string
  createdBefore: string
  propertyType: string
}

export interface FilterMappingResult {
  definition: SegmentDefinition
  droppedSearch: boolean
  droppedReachability: boolean
}

export function filterStateToDefinition(f: BuyersFilterState): FilterMappingResult {
  const conditions: AttributeCondition[] = []

  // Tags: the page uses .contains (has ALL) — must map to contains_all, not contains.
  if (f.selectedTags && f.selectedTags.length > 0) {
    conditions.push({ kind: "attribute", field: "tags", operator: "contains_all", value: f.selectedTags })
  }
  // Exclude tags: has NONE.
  if (f.excludeTags && f.excludeTags.length > 0) {
    conditions.push({ kind: "attribute", field: "tags", operator: "not_contains", value: f.excludeTags })
  }
  // Locations: has ANY.
  if (f.selectedLocations && f.selectedLocations.length > 0) {
    conditions.push({ kind: "attribute", field: "locations", operator: "contains", value: f.selectedLocations })
  }
  // Property type: single value, has ANY.
  if (f.propertyType && f.propertyType !== "any" && f.propertyType !== "") {
    conditions.push({ kind: "attribute", field: "property_type", operator: "contains", value: [f.propertyType] })
  }
  // Score min/max → separate gte/lte (same calls the page makes).
  if (f.minScore) {
    conditions.push({ kind: "attribute", field: "score", operator: "gte", value: Number(f.minScore) })
  }
  if (f.maxScore) {
    conditions.push({ kind: "attribute", field: "score", operator: "lte", value: Number(f.maxScore) })
  }
  // VIP / vetted booleans.
  if (f.vip === "vip") conditions.push({ kind: "attribute", field: "vip", operator: "is", value: true })
  else if (f.vip === "not-vip") conditions.push({ kind: "attribute", field: "vip", operator: "is_not", value: true })
  if (f.vetted === "vetted") conditions.push({ kind: "attribute", field: "vetted", operator: "is", value: true })
  else if (f.vetted === "not-vetted") conditions.push({ kind: "attribute", field: "vetted", operator: "is_not", value: true })

  // Created range → ONE inclusive between (gte/lte), matching the page.
  if (f.createdAfter || f.createdBefore) {
    conditions.push({
      kind: "attribute",
      field: "created_at",
      operator: "between",
      value: { min: f.createdAfter || undefined, max: f.createdBefore || undefined } as any,
    })
  }

  const droppedSearch = !!(f.search && f.search.trim())
  const droppedReachability =
    f.canReceiveEmail === "yes" ||
    f.canReceiveEmail === "no" ||
    f.canReceiveSMS === "yes" ||
    f.canReceiveSMS === "no"

  return {
    definition: { match: "all", conditions },
    droppedSearch,
    droppedReachability,
  }
}
