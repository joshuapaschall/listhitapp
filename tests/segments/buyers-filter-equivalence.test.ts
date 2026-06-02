// HARD GATE: the unified Buyers-page attribute filtering must apply the IDENTICAL
// Supabase predicates as the pre-refactor fetchBuyers. We replicate the exact old
// attribute block here and assert the recorded calls match the new unified path
// except the deliberate Not VIP/Not vetted semantics change: blanks now count as "not".
// (filterStateToDefinition → applyAttributeConditions) for a representative matrix.
import { filterStateToDefinition, type BuyersFilterState } from "@/lib/segments/filter-mapping"
import { applyAttributeConditions } from "@/lib/segments/apply-filters"
import type { AttributeCondition } from "@/lib/segments/types"

interface Call {
  m: string
  args: any[]
}

// Recording chainable — every filter method records and returns itself.
function recorder() {
  const calls: Call[] = []
  const q: any = { calls }
  for (const m of ["eq", "gte", "lte", "lt", "gt", "is", "not", "or", "contains", "overlaps", "ilike", "neq"]) {
    q[m] = (...args: any[]) => {
      calls.push({ m, args })
      return q
    }
  }
  return q
}

// The EXACT attribute block that fetchBuyers applied before this refactor.
function oldAttributeBlock(query: any, filters: BuyersFilterState) {
  let q = query
  if (filters.vip === "vip") q = q.eq("vip", true)
  else if (filters.vip === "not-vip") q = q.not("vip", "is", true)

  if (filters.vetted === "vetted") q = q.eq("vetted", true)
  else if (filters.vetted === "not-vetted") q = q.not("vetted", "is", true)

  if (filters.minScore) q = q.gte("score", Number.parseInt(filters.minScore))
  if (filters.maxScore) q = q.lte("score", Number.parseInt(filters.maxScore))
  if (filters.createdAfter) q = q.gte("created_at", filters.createdAfter)
  if (filters.createdBefore) q = q.lte("created_at", filters.createdBefore)

  if (filters.selectedTags && filters.selectedTags.length > 0) q = q.contains("tags", filters.selectedTags)
  if (filters.excludeTags && filters.excludeTags.length > 0) {
    const exclude = `{${filters.excludeTags.map((t) => `"${t}"`).join(",")}}`
    q = q.not("tags", "ov", exclude)
  }
  if (filters.selectedLocations && filters.selectedLocations.length > 0) q = q.overlaps("locations", filters.selectedLocations)
  if (filters.propertyType && filters.propertyType !== "any") q = q.overlaps("property_type", [filters.propertyType])
  return q
}

function newAttributeBlock(query: any, filters: BuyersFilterState) {
  const { conditions } = filterStateToDefinition(filters).definition
  return applyAttributeConditions(query, conditions as AttributeCondition[])
}

// Order-insensitive multiset of recorded calls.
const norm = (calls: Call[]) => calls.map((c) => `${c.m}:${JSON.stringify(c.args)}`).sort()

const empty: BuyersFilterState = {
  search: "", selectedTags: [], excludeTags: [], selectedLocations: [],
  minScore: "", maxScore: "", vip: "", vetted: "", canReceiveEmail: "", canReceiveSMS: "",
  createdAfter: "", createdBefore: "", propertyType: "",
}
const f = (over: Partial<BuyersFilterState>): BuyersFilterState => ({ ...empty, ...over })

const MATRIX: Array<[string, BuyersFilterState]> = [
  ["tags multi", f({ selectedTags: ["cash", "vip"] })],
  ["excludeTags", f({ excludeTags: ["spam", "dead"] })],
  ["locations", f({ selectedLocations: ["TX", "FL"] })],
  ["score min+max", f({ minScore: "10", maxScore: "90" })],
  ["vip", f({ vip: "vip" })],
  ["not-vip", f({ vip: "not-vip" })],
  ["vetted", f({ vetted: "vetted" })],
  ["created range", f({ createdAfter: "2026-01-01", createdBefore: "2026-02-01" })],
  ["propertyType", f({ propertyType: "sfr" })],
  ["propertyType any (skip)", f({ propertyType: "any" })],
  [
    "combo",
    f({
      selectedTags: ["cash"], excludeTags: ["spam"], selectedLocations: ["TX"],
      minScore: "20", maxScore: "80", vip: "vip", vetted: "vetted",
      createdAfter: "2026-01-01", createdBefore: "2026-03-01", propertyType: "multifamily",
    }),
  ],
]

describe("Buyers filter equivalence (unified == old fetchBuyers)", () => {
  test.each(MATRIX)("same predicates for: %s", (_label, filters) => {
    const oldQ = recorder()
    const newQ = recorder()
    oldAttributeBlock(oldQ, filters)
    newAttributeBlock(newQ, filters)
    expect(norm(newQ.calls)).toEqual(norm(oldQ.calls))
  })

  test("tags map to .contains (has ALL), NOT .overlaps", () => {
    const q = recorder()
    newAttributeBlock(q, f({ selectedTags: ["a", "b"] }))
    expect(q.calls).toContainEqual({ m: "contains", args: ["tags", ["a", "b"]] })
    expect(q.calls.find((c: Call) => c.m === "overlaps" && c.args[0] === "tags")).toBeUndefined()
  })

  test("not-vip and not-vetted include blank flags via IS NOT true", () => {
    const vipQ = recorder()
    newAttributeBlock(vipQ, f({ vip: "not-vip" }))
    expect(vipQ.calls).toContainEqual({ m: "not", args: ["vip", "is", true] })

    const vettedQ = recorder()
    newAttributeBlock(vettedQ, f({ vetted: "not-vetted" }))
    expect(vettedQ.calls).toContainEqual({ m: "not", args: ["vetted", "is", true] })
  })

  test("created range maps to inclusive gte + lte", () => {
    const q = recorder()
    newAttributeBlock(q, f({ createdAfter: "2026-01-01", createdBefore: "2026-02-01" }))
    expect(q.calls).toContainEqual({ m: "gte", args: ["created_at", "2026-01-01"] })
    expect(q.calls).toContainEqual({ m: "lte", args: ["created_at", "2026-02-01"] })
  })

  test("excludeTags literal format matches the old page exactly", () => {
    const q = recorder()
    newAttributeBlock(q, f({ excludeTags: ["a", "b"] }))
    expect(q.calls).toContainEqual({ m: "not", args: ["tags", "ov", '{"a","b"}'] })
  })
})
