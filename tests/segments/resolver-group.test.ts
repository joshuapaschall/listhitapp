import {
  resolveGroupCondition,
  resolveSegment,
  validateDefinition,
} from "@/lib/segments/resolver"
import type { GroupCondition, ResolveContext, SegmentDefinition } from "@/lib/segments/types"

// ---------------------------------------------------------------------------
// Chainable Supabase mock (same shape as resolver.test.ts): every filter method
// records its call and returns the same query object; the terminal .range()
// resolves to canned rows produced by a per-test resolve(state) function.
// ---------------------------------------------------------------------------

interface MethodCall {
  m: string
  args: any[]
}
interface QueryState {
  table: string
  calls: MethodCall[]
}

function makeClient(resolve: (state: QueryState) => any[]) {
  const allCalls: MethodCall[] = []

  function makeQuery(table: string) {
    const state: QueryState = { table, calls: [] }
    const record = (m: string, args: any[]) => {
      state.calls.push({ m, args })
      allCalls.push({ m: `${table}.${m}`, args })
    }
    const q: any = {}
    const chain = ["select", "eq", "neq", "is", "not", "gte", "lte", "gt", "lt", "ilike", "overlaps", "contains", "or", "in", "order"]
    for (const m of chain) {
      q[m] = (...args: any[]) => {
        record(m, args)
        return q
      }
    }
    q.range = (from: number, to: number) => {
      record("range", [from, to])
      return Promise.resolve({ data: resolve(state).slice(from, to + 1), error: null })
    }
    q.limit = (n: number) => {
      record("limit", [n])
      return Promise.resolve({ data: resolve(state), error: null })
    }
    return q
  }

  const client = {
    from: (table: string) => {
      allCalls.push({ m: "from", args: [table] })
      return makeQuery(table)
    },
  }
  return { client, allCalls }
}

// The group-id array passed to `.in("group_id", [...])`.
const groupInArg = (s: QueryState): string[] =>
  s.calls.find((c) => c.m === "in" && c.args[0] === "group_id")?.args[1] ?? []

const baseCtx = (over: Partial<ResolveContext> = {}): ResolveContext => ({
  supabase: null,
  orgId: "org-1",
  channel: "email",
  ...over,
})

describe("resolveGroupCondition", () => {
  test("in_any → the union of members across the listed groups (one query)", async () => {
    const { client, allCalls } = makeClient((s) =>
      s.table === "buyer_groups" ? [{ buyer_id: "a" }, { buyer_id: "b" }, { buyer_id: "c" }] : [],
    )
    const cond: GroupCondition = { kind: "group", operator: "in_any", groupIds: ["g1", "g2"] }
    const result = await resolveGroupCondition(cond, baseCtx({ supabase: client }))

    expect([...result].sort()).toEqual(["a", "b", "c"])
    // Org-scoped through the buyers join; never trusts group_id alone.
    expect(allCalls).toContainEqual({ m: "buyer_groups.eq", args: ["buyers.org_id", "org-1"] })
    expect(allCalls).toContainEqual({ m: "buyer_groups.is", args: ["buyers.deleted_at", null] })
    expect(allCalls).toContainEqual({ m: "buyer_groups.in", args: ["group_id", ["g1", "g2"]] })
  })

  test("in_all → only buyers present in EVERY listed group", async () => {
    // g1 = {a,b}, g2 = {b,c} → intersection = {b}
    const { client } = makeClient((s) => {
      if (s.table !== "buyer_groups") return []
      const ids = groupInArg(s)
      if (ids.length === 1 && ids[0] === "g1") return [{ buyer_id: "a" }, { buyer_id: "b" }]
      if (ids.length === 1 && ids[0] === "g2") return [{ buyer_id: "b" }, { buyer_id: "c" }]
      return []
    })
    const cond: GroupCondition = { kind: "group", operator: "in_all", groupIds: ["g1", "g2"] }
    const result = await resolveGroupCondition(cond, baseCtx({ supabase: client }))

    expect([...result].sort()).toEqual(["b"])
  })

  test("not_in → eligible universe minus members of any listed group", async () => {
    // universe = {a,b,c,d} (eligible), members = {b,c} → {a,d}
    const { client } = makeClient((s) => {
      if (s.table === "buyer_groups") return [{ buyer_id: "b" }, { buyer_id: "c" }]
      if (s.table === "buyers") return [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]
      return []
    })
    const cond: GroupCondition = { kind: "group", operator: "not_in", groupIds: ["g1"] }
    const result = await resolveGroupCondition(cond, baseCtx({ supabase: client }))

    expect([...result].sort()).toEqual(["a", "d"])
  })

  test("empty groupIds → empty set (never widens)", async () => {
    const { client, allCalls } = makeClient(() => [{ buyer_id: "should-not-appear" }])
    const cond: GroupCondition = { kind: "group", operator: "in_any", groupIds: [] }
    const result = await resolveGroupCondition(cond, baseCtx({ supabase: client }))

    expect(result.size).toBe(0)
    // No query issued at all.
    expect(allCalls.some((c) => c.m === "from" && c.args[0] === "buyer_groups")).toBe(false)
  })

  test("resolveSegment gates a group condition by the eligible universe", async () => {
    // group members = {a,b,c}; eligible universe = {b,c,d} → {b,c}
    const { client } = makeClient((s) => {
      if (s.table === "buyer_groups") return [{ buyer_id: "a" }, { buyer_id: "b" }, { buyer_id: "c" }]
      if (s.table === "buyers") return [{ id: "b" }, { id: "c" }, { id: "d" }]
      return []
    })
    const def: SegmentDefinition = {
      match: "all",
      conditions: [{ kind: "group", operator: "in_any", groupIds: ["g1"] }],
    }
    const result = await resolveSegment(def, baseCtx({ supabase: client }))
    expect([...result].sort()).toEqual(["b", "c"])
  })
})

describe("validateDefinition — group conditions", () => {
  test("accepts a valid group condition", () => {
    expect(() =>
      validateDefinition({
        match: "all",
        conditions: [{ kind: "group", operator: "in_any", groupIds: ["g1", "g2"] }],
      }),
    ).not.toThrow()
  })

  test("rejects a bad operator", () => {
    expect(() =>
      validateDefinition({
        match: "all",
        conditions: [{ kind: "group", operator: "nope" as any, groupIds: ["g1"] }],
      }),
    ).toThrow(/Group operator/)
  })

  test("rejects a non-array groupIds", () => {
    expect(() =>
      validateDefinition({
        match: "all",
        conditions: [{ kind: "group", operator: "in_any", groupIds: "g1" as any }],
      }),
    ).toThrow(/array of strings/)
  })
})
