// One shared applier for attribute conditions, reused by the Buyers list, the
// campaign service, and the buyer service so all three apply IDENTICAL
// predicates. It loops conditions through the SAME `applyAttributeFilter`
// primitive the engine uses — there is exactly one implementation.
//
// Org scoping, search, reachability, group joins, pagination, and ordering are
// the caller's responsibility (kept as direct predicates).

import { applyAttributeFilter } from "./resolver"
import { ATTRIBUTE_BY_FIELD } from "./catalog"
import type { AttributeCondition } from "./types"

export function applyAttributeConditions<Q>(query: Q, conditions: AttributeCondition[]): Q {
  let q: any = query
  for (const cond of conditions) {
    const spec = ATTRIBUTE_BY_FIELD[cond.field]
    if (!spec) continue // unknown field → skip (never silently mis-filter)
    q = applyAttributeFilter(q, cond, spec)
  }
  return q as Q
}
