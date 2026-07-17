import { resolveAudienceIds } from "@/lib/campaigns/resolve-audience-ids"

// A chainable Supabase stub. `applyChannelEligibility` (the real one) calls
// .is/.eq/.not on it; the resolver adds .select/.eq/.in; fetchAllRows adds
// .order/.range; fetchRowsByIdChunks awaits directly.
function makeSupabase(groupBuyerIds: string[] = [], opts: { failGroups?: boolean } = {}) {
  const eqCalls: Array<[string, unknown]> = []
  const rangeCalls: Array<[number, number]> = []
  const fromCalls: string[] = []

  const supabase = {
    from(table: string) {
      fromCalls.push(table)
      const q: any = {
        _in: null as null | { col: string; vals: unknown[] },
        select() { return q },
        eq(col: string, val: unknown) { eqCalls.push([col, val]); return q },
        in(col: string, vals: unknown[]) { q._in = { col, vals }; return q },
        is() { return q },
        not() { return q },
        order() { return q },
        range(from: number, to: number) {
          rangeCalls.push([from, to])
          if (table === "buyer_groups") {
            if (opts.failGroups) return Promise.resolve({ data: null, error: new Error("db fail") })
            const page = groupBuyerIds.slice(from, to + 1).map((buyer_id) => ({ buyer_id }))
            return Promise.resolve({ data: page, error: null })
          }
          return Promise.resolve({ data: [], error: null })
        },
        then(resolve: (v: { data: unknown; error: unknown }) => unknown) {
          // buyers chunk query: echo the requested ids back as { id } rows
          const ids = (q._in?.vals as string[]) ?? []
          return Promise.resolve({ data: ids.map((id) => ({ id })), error: null }).then(resolve)
        },
      }
      return q
    },
    _eqCalls: eqCalls,
    _rangeCalls: rangeCalls,
    _fromCalls: fromCalls,
  }
  return supabase
}

describe("resolveAudienceIds", () => {
  test("pages past the 1000-row cap — 11,878-style group returns 1,878, not 1,000", async () => {
    const groupBuyerIds = Array.from({ length: 1878 }, (_, i) => `bg-${i}`)
    const sb = makeSupabase(groupBuyerIds)

    const ids = await resolveAudienceIds({ supabase: sb, orgId: "org-1", channel: "email", groupIds: ["g1"] })

    expect(ids).toHaveLength(1878)
    // .range() must have been called twice (page 0-999, then 1000-1999).
    expect(sb._rangeCalls.length).toBe(2)
    expect(sb._rangeCalls[0]).toEqual([0, 999])
    expect(sb._rangeCalls[1]).toEqual([1000, 1999])
  })

  test("org-scopes BOTH the buyer_groups and the buyers query", async () => {
    const sb = makeSupabase(["a"])
    await resolveAudienceIds({ supabase: sb, orgId: "org-9", channel: "email", groupIds: ["g1"] })

    const orgScopes = sb._eqCalls.filter(([c, v]) => c === "org_id" && v === "org-9")
    expect(orgScopes).toHaveLength(2)
  })

  test("applies email eligibility filters with the right prefixes", async () => {
    const sb = makeSupabase(["a"])
    await resolveAudienceIds({ supabase: sb, orgId: "o", channel: "email", groupIds: ["g1"] })

    // prefixed on the join
    expect(sb._eqCalls).toContainEqual(["buyers.email_suppressed", false])
    expect(sb._eqCalls).toContainEqual(["buyers.can_receive_email", true])
    // unprefixed on the buyers query
    expect(sb._eqCalls).toContainEqual(["email_suppressed", false])
    expect(sb._eqCalls).toContainEqual(["can_receive_email", true])
  })

  test("applies sms eligibility filters", async () => {
    const sb = makeSupabase(["a"])
    await resolveAudienceIds({ supabase: sb, orgId: "o", channel: "sms", groupIds: ["g1"] })

    expect(sb._eqCalls).toContainEqual(["buyers.can_receive_sms", true])
    expect(sb._eqCalls).toContainEqual(["buyers.sms_suppressed", false])
    expect(sb._eqCalls).toContainEqual(["can_receive_sms", true])
    expect(sb._eqCalls).toContainEqual(["sms_suppressed", false])
  })

  test("unions and dedupes buyerIds with groupIds", async () => {
    const sb = makeSupabase(["a", "c"]) // group resolves to a, c
    const ids = await resolveAudienceIds({
      supabase: sb,
      orgId: "o",
      channel: "email",
      buyerIds: ["a", "b"], // 'a' overlaps the group
      groupIds: ["g1"],
    })
    expect([...ids].sort()).toEqual(["a", "b", "c"])
  })

  test("empty input returns [] and issues zero queries", async () => {
    const sb = makeSupabase([])
    const ids = await resolveAudienceIds({ supabase: sb, orgId: "o", channel: "email", buyerIds: [], groupIds: [] })
    expect(ids).toEqual([])
    expect(sb._fromCalls).toHaveLength(0)
    expect(sb._rangeCalls).toHaveLength(0)
  })

  test("propagates a rejecting builder (no swallow)", async () => {
    const sb = makeSupabase(["a"], { failGroups: true })
    await expect(
      resolveAudienceIds({ supabase: sb, orgId: "o", channel: "email", groupIds: ["g1"] }),
    ).rejects.toThrow("db fail")
  })
})
