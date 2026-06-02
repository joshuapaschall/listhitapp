import {
  intersectSets,
  unionSets,
  subtractSets,
  combineSets,
  resolveAttributeCondition,
  resolveBehavioralCondition,
  resolveSegment,
  validateDefinition,
} from "@/lib/segments/resolver"
import type {
  AttributeCondition,
  BehavioralCondition,
  ResolveContext,
  SegmentDefinition,
} from "@/lib/segments/types"

// ---------------------------------------------------------------------------
// Chainable Supabase mock. Every filter method records its call and returns the
// same query object; the terminal .range() resolves to canned rows produced by
// a per-test resolve(state) function. No real DB.
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
      const call = { m, args }
      state.calls.push(call)
      allCalls.push({ m: `${table}.${m}`, args })
    }
    const q: any = {}
    const chain = ["select", "eq", "neq", "is", "not", "gte", "lte", "gt", "lt", "ilike", "overlaps", "or", "in", "order"]
    for (const m of chain) {
      q[m] = (...args: any[]) => {
        record(m, args)
        return q
      }
    }
    q.range = (from: number, to: number) => {
      record("range", [from, to])
      return Promise.resolve({ data: resolve(state), error: null })
    }
    // Terminal for the lastNCampaignIds lookup (`await q.order().order().limit()`).
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

// State inspection helpers used by per-test resolve() functions.
const eqValue = (s: QueryState, col: string) =>
  s.calls.find((c) => c.m === "eq" && c.args[0] === col)?.args[1]
const hasMethodCol = (s: QueryState, m: string, col: string) =>
  s.calls.some((c) => c.m === m && c.args[0] === col)
const notCols = (s: QueryState) =>
  s.calls.filter((c) => c.m === "not").map((c) => c.args[0])

const baseCtx = (over: Partial<ResolveContext> = {}): ResolveContext => ({
  supabase: null,
  orgId: "org-1",
  channel: "email",
  ...over,
})

// ===========================================================================
// Pure combinators (no DB)
// ===========================================================================

describe("pure set combinators", () => {
  const S = (...v: string[]) => new Set(v)

  test("intersectSets", () => {
    expect([...intersectSets([S("a", "b", "c"), S("b", "c", "d")])].sort()).toEqual(["b", "c"])
    expect(intersectSets([]).size).toBe(0) // empty input -> empty set
    expect([...intersectSets([S("a", "b")])].sort()).toEqual(["a", "b"])
    expect(intersectSets([S("a"), S("b")]).size).toBe(0) // disjoint
  })

  test("unionSets", () => {
    expect([...unionSets([S("a", "b"), S("b", "c")])].sort()).toEqual(["a", "b", "c"])
    expect(unionSets([]).size).toBe(0)
  })

  test("subtractSets", () => {
    expect([...subtractSets(S("a", "b", "c"), S("b"))].sort()).toEqual(["a", "c"])
    expect(subtractSets(S("a"), S("a")).size).toBe(0)
    expect([...subtractSets(S("a"), new Set<string>())].sort()).toEqual(["a"])
  })

  test("combineSets all -> intersection, any -> union", () => {
    const sets = [S("a", "b", "c"), S("b", "c", "d")]
    expect([...combineSets("all", sets)].sort()).toEqual(["b", "c"])
    expect([...combineSets("any", sets)].sort()).toEqual(["a", "b", "c", "d"])
    expect(combineSets("all", []).size).toBe(0)
    expect(combineSets("any", []).size).toBe(0)
  })
})

// ===========================================================================
// validateDefinition
// ===========================================================================

describe("validateDefinition", () => {
  test("throws on unknown field / operator / metric", () => {
    expect(() =>
      validateDefinition({ match: "all", conditions: [{ kind: "attribute", field: "nope" as any, operator: "is" }] }),
    ).toThrow(/Unknown attribute field/)
    expect(() =>
      validateDefinition({ match: "all", conditions: [{ kind: "attribute", field: "vip", operator: "contains" }] }),
    ).toThrow(/not supported/)
    expect(() =>
      validateDefinition({
        match: "all",
        conditions: [{ kind: "behavioral", metric: "nope" as any, operator: "did", scope: { type: "any_campaign" } }],
      }),
    ).toThrow(/Unknown behavioral metric/)
  })

  test("accepts a valid definition", () => {
    expect(() =>
      validateDefinition({
        match: "any",
        conditions: [
          { kind: "attribute", field: "tags", operator: "contains", value: ["vip"] },
          { kind: "behavioral", metric: "opened", operator: "did_not", scope: { type: "any_campaign" } },
        ],
      }),
    ).not.toThrow()
  })
})

// ===========================================================================
// resolveAttributeCondition
// ===========================================================================

describe("resolveAttributeCondition", () => {
  test("returns the id set and issues the right filter for text[] contains", async () => {
    const { client, allCalls } = makeClient(() => [{ id: "a" }, { id: "b" }])
    const cond: AttributeCondition = { kind: "attribute", field: "tags", operator: "contains", value: ["vip", "cash"] }
    const result = await resolveAttributeCondition(cond, baseCtx({ supabase: client }))

    expect([...result].sort()).toEqual(["a", "b"])
    const overlaps = allCalls.find((c) => c.m === "buyers.overlaps")
    expect(overlaps?.args).toEqual(["tags", ["vip", "cash"]])
    // Always org-scoped + not deleted.
    expect(allCalls).toContainEqual({ m: "buyers.eq", args: ["org_id", "org-1"] })
    expect(allCalls).toContainEqual({ m: "buyers.is", args: ["deleted_at", null] })
  })

  test("number between issues gte + lte", async () => {
    const { client, allCalls } = makeClient(() => [{ id: "a" }])
    const cond: AttributeCondition = { kind: "attribute", field: "score", operator: "between", value: { min: 10, max: 20 } }
    await resolveAttributeCondition(cond, baseCtx({ supabase: client }))

    expect(allCalls).toContainEqual({ m: "buyers.gte", args: ["score", 10] })
    expect(allCalls).toContainEqual({ m: "buyers.lte", args: ["score", 20] })
  })

  test("boolean is issues eq(true)", async () => {
    const { client, allCalls } = makeClient(() => [{ id: "a" }])
    const cond: AttributeCondition = { kind: "attribute", field: "vip", operator: "is", value: true }
    await resolveAttributeCondition(cond, baseCtx({ supabase: client }))

    expect(allCalls).toContainEqual({ m: "buyers.eq", args: ["vip", true] })
  })

  test("date within_days issues gte(created_at, <iso>)", async () => {
    const { client, allCalls } = makeClient(() => [{ id: "a" }])
    const cond: AttributeCondition = { kind: "attribute", field: "created_at", operator: "within_days", value: { days: 30 } }
    await resolveAttributeCondition(cond, baseCtx({ supabase: client }))

    const gte = allCalls.find((c) => c.m === "buyers.gte" && c.args[0] === "created_at")
    expect(gte).toBeTruthy()
    expect(typeof gte?.args[1]).toBe("string") // ISO timestamp
  })
})

// ===========================================================================
// resolveBehavioralCondition
// ===========================================================================

describe("resolveBehavioralCondition", () => {
  // Sent {x,y,z}, opened {y}. did opened -> {y}; did_not opened -> {x,z}.
  const recipientResolve = (s: QueryState) => {
    const cols = notCols(s)
    if (cols.includes("opened_at")) return [{ buyer_id: "y" }]
    if (cols.includes("sent_at")) return [{ buyer_id: "x" }, { buyer_id: "y" }, { buyer_id: "z" }]
    return []
  }

  test("did opened returns the opened set", async () => {
    const { client } = makeClient(recipientResolve)
    const cond: BehavioralCondition = { kind: "behavioral", metric: "opened", operator: "did", scope: { type: "any_campaign" } }
    const result = await resolveBehavioralCondition(cond, baseCtx({ supabase: client }))
    expect([...result].sort()).toEqual(["y"])
  })

  test("did_not opened = (sent set) - (opened set)", async () => {
    const { client, allCalls } = makeClient(recipientResolve)
    const cond: BehavioralCondition = { kind: "behavioral", metric: "opened", operator: "did_not", scope: { type: "any_campaign" } }
    const result = await resolveBehavioralCondition(cond, baseCtx({ supabase: client }))
    expect([...result].sort()).toEqual(["x", "z"])
    // Org scope flows through the joined campaign.
    expect(allCalls).toContainEqual({ m: "campaign_recipients.eq", args: ["campaigns.org_id", "org-1"] })
  })

  test('scope "this_campaign" without contextCampaignId throws', async () => {
    const { client } = makeClient(recipientResolve)
    const cond: BehavioralCondition = { kind: "behavioral", metric: "opened", operator: "did", scope: { type: "this_campaign" } }
    await expect(resolveBehavioralCondition(cond, baseCtx({ supabase: client }))).rejects.toThrow(/contextCampaignId/)
  })
})

// ===========================================================================
// Phase 2.5 — channel-scoped behavioral conditions + last_n_campaigns
// ===========================================================================

const channelEq = (s: QueryState) =>
  s.calls.find((c) => c.m === "eq" && c.args[0] === "campaigns.channel")?.args[1]
const channelIn = (s: QueryState) =>
  s.calls.find((c) => c.m === "in" && c.args[0] === "campaigns.channel")?.args[1]
const sawRecipientQuery = (allCalls: MethodCall[]) =>
  allCalls.some((c) => c.m === "from" && c.args[0] === "campaign_recipients")

describe("behavioral channel scoping", () => {
  test("an unset channel defaults to ctx.channel (sms)", async () => {
    const { client, allCalls } = makeClient(() => [])
    const cond: BehavioralCondition = { kind: "behavioral", metric: "clicked", operator: "did", scope: { type: "any_campaign" } }
    await resolveBehavioralCondition(cond, baseCtx({ supabase: client, channel: "sms" }))
    expect(allCalls).toContainEqual({ m: "campaign_recipients.eq", args: ["campaigns.channel", "sms"] })
  })

  test("an unset channel defaults to ctx.channel (email)", async () => {
    const { client, allCalls } = makeClient(() => [])
    const cond: BehavioralCondition = { kind: "behavioral", metric: "clicked", operator: "did", scope: { type: "any_campaign" } }
    await resolveBehavioralCondition(cond, baseCtx({ supabase: client, channel: "email" }))
    expect(allCalls).toContainEqual({ m: "campaign_recipients.eq", args: ["campaigns.channel", "email"] })
  })

  test("cross-channel bleed: an email clicker is excluded from an sms 'clicked' (and included for email)", async () => {
    // X clicked only an email campaign.
    const resolve = (s: QueryState) => {
      if (s.table !== "campaign_recipients") return []
      const cols = notCols(s)
      if (channelEq(s) === "email" && cols.includes("clicked_at")) return [{ buyer_id: "X" }]
      return []
    }
    const cond: BehavioralCondition = { kind: "behavioral", metric: "clicked", operator: "did", scope: { type: "any_campaign" } }

    const sms = makeClient(resolve)
    const smsResult = await resolveBehavioralCondition(cond, baseCtx({ supabase: sms.client, channel: "sms" }))
    expect(smsResult.has("X")).toBe(false)

    const email = makeClient(resolve)
    const emailResult = await resolveBehavioralCondition(cond, baseCtx({ supabase: email.client, channel: "email" }))
    expect(emailResult.has("X")).toBe(true)
  })

  test('channel "any" spans both channels (uses .in, not a single .eq)', async () => {
    const { client, allCalls } = makeClient(() => [])
    const cond: BehavioralCondition = { kind: "behavioral", metric: "clicked", operator: "did", scope: { type: "any_campaign" }, channel: "any" }
    await resolveBehavioralCondition(cond, baseCtx({ supabase: client, channel: "sms" }))
    expect(allCalls).toContainEqual({ m: "campaign_recipients.in", args: ["campaigns.channel", ["email", "sms"]] })
    expect(allCalls.find((c) => c.m === "campaign_recipients.eq" && c.args[0] === "campaigns.channel")).toBeUndefined()
  })

  test("metric/channel clamp: 'opened' on sms resolves to empty with NO recipient query", async () => {
    const { client, allCalls } = makeClient(() => [{ buyer_id: "should-not-appear" }])
    const cond: BehavioralCondition = { kind: "behavioral", metric: "opened", operator: "did", scope: { type: "any_campaign" } }
    const result = await resolveBehavioralCondition(cond, baseCtx({ supabase: client, channel: "sms" }))
    expect(result.size).toBe(0)
    expect(sawRecipientQuery(allCalls)).toBe(false)
  })
})

describe("behavioral last_n_campaigns scope", () => {
  test("queries last N campaign ids (channel + limit) and scopes recipients via .in(campaign_id)", async () => {
    const resolve = (s: QueryState) => {
      if (s.table === "campaigns") return [{ id: "c1" }, { id: "c2" }]
      const cols = notCols(s)
      if (cols.includes("opened_at")) return [{ buyer_id: "b" }]
      if (cols.includes("sent_at")) return [{ buyer_id: "a" }, { buyer_id: "b" }]
      return []
    }
    const { client, allCalls } = makeClient(resolve)
    const cond: BehavioralCondition = { kind: "behavioral", metric: "opened", operator: "did_not", scope: { type: "last_n_campaigns", n: 5 } }
    const result = await resolveBehavioralCondition(cond, baseCtx({ supabase: client, channel: "email" }))

    // didn't open any of the last N = sent(last_n) − opened(last_n) = {a,b} − {b} = {a}
    expect([...result].sort()).toEqual(["a"])
    // campaign-id lookup ran with the channel filter + limit
    expect(allCalls).toContainEqual({ m: "campaigns.eq", args: ["channel", "email"] })
    expect(allCalls).toContainEqual({ m: "campaigns.limit", args: [5] })
    // recipients scoped to those ids
    expect(allCalls).toContainEqual({ m: "campaign_recipients.in", args: ["campaign_id", ["c1", "c2"]] })
  })

  test("zero campaigns on the channel → empty set, no .in([]) recipient query", async () => {
    const resolve = (s: QueryState) => (s.table === "campaigns" ? [] : [{ buyer_id: "a" }])
    const { client, allCalls } = makeClient(resolve)
    const cond: BehavioralCondition = { kind: "behavioral", metric: "opened", operator: "did_not", scope: { type: "last_n_campaigns", n: 3 } }
    const result = await resolveBehavioralCondition(cond, baseCtx({ supabase: client, channel: "email" }))

    expect(result.size).toBe(0)
    expect(sawRecipientQuery(allCalls)).toBe(false)
    expect(allCalls.find((c) => c.m === "campaign_recipients.in")).toBeUndefined()
  })
})

// ===========================================================================
// resolveSegment end-to-end
// ===========================================================================

describe("resolveSegment", () => {
  // setA(tags)={a,b,c}, setB(score)={b,c,d}, eligible universe={b,c,d} (drops 'a').
  const segmentResolve = (s: QueryState) => {
    if (s.table !== "buyers") return []
    if (eqValue(s, "email_suppressed") !== undefined) {
      return [{ id: "b" }, { id: "c" }, { id: "d" }] // eligible universe
    }
    if (hasMethodCol(s, "overlaps", "tags")) return [{ id: "a" }, { id: "b" }, { id: "c" }]
    if (hasMethodCol(s, "gte", "score")) return [{ id: "b" }, { id: "c" }, { id: "d" }]
    return []
  }

  const tagCond: AttributeCondition = { kind: "attribute", field: "tags", operator: "contains", value: ["vip"] }
  const scoreCond: AttributeCondition = { kind: "attribute", field: "score", operator: "gte", value: 50 }

  test("all -> intersection, then gated by eligible universe", async () => {
    const { client } = makeClient(segmentResolve)
    const def: SegmentDefinition = { match: "all", conditions: [tagCond, scoreCond] }
    const result = await resolveSegment(def, baseCtx({ supabase: client }))
    // intersect({a,b,c},{b,c,d}) = {b,c}; ∩ universe {b,c,d} = {b,c}
    expect([...result].sort()).toEqual(["b", "c"])
  })

  test("any -> union, then gated by eligible universe (drops ineligible 'a')", async () => {
    const { client } = makeClient(segmentResolve)
    const def: SegmentDefinition = { match: "any", conditions: [tagCond, scoreCond] }
    const result = await resolveSegment(def, baseCtx({ supabase: client }))
    // union({a,b,c},{b,c,d}) = {a,b,c,d}; ∩ universe {b,c,d} = {b,c,d}
    expect([...result].sort()).toEqual(["b", "c", "d"])
  })

  test("empty conditions -> the eligible universe", async () => {
    const { client } = makeClient(segmentResolve)
    const def: SegmentDefinition = { match: "all", conditions: [] }
    const result = await resolveSegment(def, baseCtx({ supabase: client }))
    expect([...result].sort()).toEqual(["b", "c", "d"])
  })
})
