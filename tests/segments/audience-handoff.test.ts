import { encodeAudienceParam, decodeAudienceParam } from "@/lib/segments/audience-handoff"
import { filterStateToDefinition, type BuyersFilterState } from "@/lib/segments/filter-mapping"
import type { SegmentDefinition } from "@/lib/segments/types"

const DEF: SegmentDefinition = {
  match: "all",
  conditions: [
    { kind: "attribute", field: "tags", operator: "contains_all", value: ["cash", "vip"] },
    { kind: "attribute", field: "score", operator: "gte", value: 50 },
  ],
}

describe("audience handoff (?audience=)", () => {
  test("encode → decode round-trips the definition", () => {
    const encoded = encodeAudienceParam(DEF)
    // URL-safe: no +, /, or = padding
    expect(encoded).not.toMatch(/[+/=]/)
    expect(decodeAudienceParam(encoded)).toEqual(DEF)
  })

  test("a Buyers-filter definition survives the round-trip", () => {
    const filters: BuyersFilterState = {
      search: "", selectedTags: ["cash"], excludeTags: [], selectedLocations: ["TX"],
      minScore: "20", maxScore: "", vip: "vip", vetted: "", canReceiveEmail: "", canReceiveSMS: "",
      createdAfter: "2026-01-01", createdBefore: "", propertyType: "sfr",
    }
    const { definition } = filterStateToDefinition(filters)
    expect(decodeAudienceParam(encodeAudienceParam(definition))).toEqual(definition)
  })

  test("malformed / invalid input → null (never throws)", () => {
    expect(decodeAudienceParam(undefined)).toBeNull()
    expect(decodeAudienceParam("")).toBeNull()
    expect(decodeAudienceParam("not-base64-$$$")).toBeNull()
    // valid base64 but an invalid definition (unknown field) → rejected by validateDefinition
    const bad = encodeAudienceParam({ match: "all", conditions: [{ kind: "attribute", field: "bogus" as any, operator: "is" }] })
    expect(decodeAudienceParam(bad)).toBeNull()
  })
})
