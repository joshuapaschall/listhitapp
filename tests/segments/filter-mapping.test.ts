import { filterStateToDefinition, type BuyersFilterState } from "@/lib/segments/filter-mapping"

const empty: BuyersFilterState = {
  search: "", selectedTags: [], excludeTags: [], selectedLocations: [],
  minScore: "", maxScore: "", vip: "", vetted: "", canReceiveEmail: "", canReceiveSMS: "",
  createdAfter: "", createdBefore: "", propertyType: "",
}
const f = (over: Partial<BuyersFilterState>): BuyersFilterState => ({ ...empty, ...over })

describe("filterStateToDefinition", () => {
  test("empty filters → empty definition (everyone), no drops", () => {
    const r = filterStateToDefinition(empty)
    expect(r.definition).toEqual({ match: "all", conditions: [] })
    expect(r.droppedSearch).toBe(false)
    expect(r.droppedReachability).toBe(false)
  })

  test("selectedTags map to contains_all (has ALL), not contains", () => {
    const { definition } = filterStateToDefinition(f({ selectedTags: ["vip", "cash"] }))
    expect(definition.conditions).toContainEqual({ kind: "attribute", field: "tags", operator: "contains_all", value: ["vip", "cash"] })
  })

  test("excludeTags → not_contains", () => {
    const { definition } = filterStateToDefinition(f({ excludeTags: ["spam"] }))
    expect(definition.conditions).toContainEqual({ kind: "attribute", field: "tags", operator: "not_contains", value: ["spam"] })
  })

  test("locations → contains (has any)", () => {
    const { definition } = filterStateToDefinition(f({ selectedLocations: ["TX", "FL"] }))
    expect(definition.conditions).toContainEqual({ kind: "attribute", field: "locations", operator: "contains", value: ["TX", "FL"] })
  })

  test("propertyType (not 'any') → contains single-value array", () => {
    const { definition } = filterStateToDefinition(f({ propertyType: "sfr" }))
    expect(definition.conditions).toContainEqual({ kind: "attribute", field: "property_type", operator: "contains", value: ["sfr"] })
    expect(filterStateToDefinition(f({ propertyType: "any" })).definition.conditions).toHaveLength(0)
  })

  test("score min/max → separate gte/lte", () => {
    const { definition } = filterStateToDefinition(f({ minScore: "20", maxScore: "80" }))
    expect(definition.conditions).toContainEqual({ kind: "attribute", field: "score", operator: "gte", value: 20 })
    expect(definition.conditions).toContainEqual({ kind: "attribute", field: "score", operator: "lte", value: 80 })
  })

  test("vip / vetted booleans", () => {
    expect(filterStateToDefinition(f({ vip: "vip" })).definition.conditions).toContainEqual({ kind: "attribute", field: "vip", operator: "is", value: true })
    expect(filterStateToDefinition(f({ vip: "not-vip" })).definition.conditions).toContainEqual({ kind: "attribute", field: "vip", operator: "is", value: false })
    expect(filterStateToDefinition(f({ vetted: "vetted" })).definition.conditions).toContainEqual({ kind: "attribute", field: "vetted", operator: "is", value: true })
  })

  test("created range → one inclusive between", () => {
    const { definition } = filterStateToDefinition(f({ createdAfter: "2026-01-01", createdBefore: "2026-02-01" }))
    expect(definition.conditions).toContainEqual({
      kind: "attribute", field: "created_at", operator: "between",
      value: { min: "2026-01-01", max: "2026-02-01" },
    })
    // only one side set
    const oneSide = filterStateToDefinition(f({ createdAfter: "2026-01-01" })).definition.conditions
    expect(oneSide).toContainEqual({ kind: "attribute", field: "created_at", operator: "between", value: { min: "2026-01-01", max: undefined } })
  })

  test("search and reachability are NOT mapped, but flagged", () => {
    const r = filterStateToDefinition(f({ search: "john", canReceiveEmail: "yes", canReceiveSMS: "no" }))
    expect(r.definition.conditions).toHaveLength(0)
    expect(r.droppedSearch).toBe(true)
    expect(r.droppedReachability).toBe(true)
  })
})
