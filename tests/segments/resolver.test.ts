import {
  intersectSets,
  unionSets,
  subtractSets,
  combineSets,
  resolveAttributeCondition,
  resolveBehavioralCondition,
  resolveEligibleUniverse,
  SegmentContextError,
  definitionNeedsCampaignContext,
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
    // Terminal for the lastNCampaignIds lookup (`await q.order().limit()`).
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

  test("rejects malformed numeric scope/operator values cleanly", () => {
    expect(() =>
      validateDefinition({
        match: "all",
        conditions: [{ kind: "behavioral", metric: "sent", operator: "did", scope: { type: "within_days", days: Number.NaN } }],
      }),
    ).toThrow(/within_days scope/)
    expect(() =>
      validateDefinition({
        match: "all",
        conditions: [{ kind: "behavioral", metric: "sent", operator: "did", scope: { type: "within_days" } as any }],
      }),
    ).toThrow(/within_days scope/)
    expect(() =>
      validateDefinition({
        match: "all",
        conditions: [{ kind: "behavioral", metric: "sent", operator: "did", scope: { type: "last_n_campaigns", n: 0 } }],
      }),
    ).toThrow(/last_n_campaigns scope/)
    expect(() =>
      validateDefinition({
        match: "all",
        conditions: [{ kind: "behavioral", metric: "sent", operator: "did", scope: { type: "last_n_campaigns", n: Number.NaN } }],
      }),
    ).toThrow(/last_n_campaigns scope/)
    expect(() =>
      validateDefinition({
        match: "all",
        conditions: [{ kind: "attribute", field: "created_at", operator: "within_days", value: { days: Number.NaN } }],
      }),
    ).toThrow(/within_days value/)
    expect(() =>
      validateDefinition({
        match: "all",
        conditions: [{ kind: "attribute", field: "score", operator: "between", value: { min: "bad", max: 10 } as any }],
      }),
    ).toThrow(/between value/)
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

  test("text[] contains_all uses .contains (has ALL), distinct from contains (.overlaps)", async () => {
    const all = makeClient(() => [{ id: "a" }])
    await resolveAttributeCondition(
      { kind: "attribute", field: "tags", operator: "contains_all", value: ["vip", "cash"] },
      baseCtx({ supabase: all.client }),
    )
    expect(all.allCalls).toContainEqual({ m: "buyers.contains", args: ["tags", ["vip", "cash"]] })
    expect(all.allCalls.find((c) => c.m === "buyers.overlaps")).toBeUndefined()

    const any = makeClient(() => [{ id: "a" }])
    await resolveAttributeCondition(
      { kind: "attribute", field: "tags", operator: "contains", value: ["vip", "cash"] },
      baseCtx({ supabase: any.client }),
    )
    expect(any.allCalls).toContainEqual({ m: "buyers.overlaps", args: ["tags", ["vip", "cash"]] })
    expect(any.allCalls.find((c) => c.m === "buyers.contains")).toBeUndefined()
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

  test("boolean is_not uses IS NOT true so null/blank rows are included", async () => {
    const pool = [
      { id: "explicit-false", vip: false, cash_buyer: false },
      { id: "blank-vip", vip: null, cash_buyer: null },
      { id: "explicit-true", vip: true, cash_buyer: true },
    ]
    const applyFilters = (s: QueryState) => {
      let out = pool
      for (const c of s.calls) {
        if (c.m === "eq" && c.args[0] === "vip") out = out.filter((r) => r.vip === c.args[1])
        if (c.m === "not" && c.args[0] === "cash_buyer" && c.args[1] === "is") {
          out = out.filter((r) => r.cash_buyer !== c.args[2])
        }
      }
      return out.map((r) => ({ id: r.id }))
    }

    const notCash = makeClient((s) => (s.table === "buyers" ? applyFilters(s) : []))
    const notCashResult = await resolveAttributeCondition(
      { kind: "attribute", field: "cash_buyer", operator: "is_not", value: true },
      baseCtx({ supabase: notCash.client }),
    )
    expect([...notCashResult].sort()).toEqual(["blank-vip", "explicit-false"])
    expect(notCash.allCalls).toContainEqual({ m: "buyers.not", args: ["cash_buyer", "is", true] })

    const vip = makeClient((s) => (s.table === "buyers" ? applyFilters(s) : []))
    const vipResult = await resolveAttributeCondition(
      { kind: "attribute", field: "vip", operator: "is", value: true },
      baseCtx({ supabase: vip.client }),
    )
    expect([...vipResult]).toEqual(["explicit-true"])
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
    // campaign-id lookup ran against actual sends only with the channel filter + limit.
    expect(allCalls).toContainEqual({ m: "campaigns.eq", args: ["channel", "email"] })
    expect(allCalls).toContainEqual({ m: "campaigns.not", args: ["sent_at", "is", null] })
    expect(allCalls).toContainEqual({ m: "campaigns.order", args: ["sent_at", { ascending: false }] })
    expect(allCalls).toContainEqual({ m: "campaigns.limit", args: [5] })
    // recipients scoped to those ids
    expect(allCalls).toContainEqual({ m: "campaign_recipients.in", args: ["campaign_id", ["c1", "c2"]] })
  })

  test("excludes the context campaign and uses prior sent campaign for resend/compose contexts", async () => {
    const resolve = (s: QueryState) => {
      if (s.table === "campaigns") return [{ id: "real-sent" }]
      if (s.table === "campaign_recipients" && notCols(s).includes("sent_at")) return [{ buyer_id: "non-opener" }]
      if (s.table === "campaign_recipients" && notCols(s).includes("opened_at")) return []
      return []
    }
    const { client, allCalls } = makeClient(resolve)
    const cond: BehavioralCondition = { kind: "behavioral", metric: "opened", operator: "did_not", scope: { type: "last_n_campaigns", n: 1 } }
    const result = await resolveBehavioralCondition(cond, baseCtx({ supabase: client, channel: "email", contextCampaignId: "draft-newer" }))

    expect([...result]).toEqual(["non-opener"])
    expect(allCalls).toContainEqual({ m: "campaigns.neq", args: ["id", "draft-newer"] })
    expect(allCalls).toContainEqual({ m: "campaign_recipients.in", args: ["campaign_id", ["real-sent"]] })
  })

  test('channel "any" scopes last campaigns across email and sms', async () => {
    const resolve = (s: QueryState) => (s.table === "campaigns" ? [{ id: "email-sent" }, { id: "sms-sent" }] : [])
    const { client, allCalls } = makeClient(resolve)
    const cond: BehavioralCondition = { kind: "behavioral", metric: "sent", operator: "did", scope: { type: "last_n_campaigns", n: 2 }, channel: "any" }
    await resolveBehavioralCondition(cond, baseCtx({ supabase: client, channel: "email" }))

    expect(allCalls).toContainEqual({ m: "campaigns.in", args: ["channel", ["email", "sms"]] })
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

  test("this_campaign without context throws SegmentContextError and is detectable", async () => {
    const { client } = makeClient(segmentResolve)
    const def: SegmentDefinition = {
      match: "all",
      conditions: [{ kind: "behavioral", metric: "sent", operator: "did", scope: { type: "this_campaign" } }],
    }

    expect(definitionNeedsCampaignContext(def)).toBe(true)
    await expect(resolveSegment(def, baseCtx({ supabase: client }))).rejects.toThrow(SegmentContextError)
  })

  test("collectColumn orders before range and paginates a full >1000-row set", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: `buyer-${String(i).padStart(4, "0")}` }))
    const { client, allCalls } = makeClient((s) => (s.table === "buyers" ? rows : []))
    const result = await resolveAttributeCondition(
      { kind: "attribute", field: "vip", operator: "is", value: true },
      baseCtx({ supabase: client }),
    )
    const orderIndex = allCalls.findIndex((c) => c.m === "buyers.order" && c.args[0] === "id")
    const firstRangeIndex = allCalls.findIndex((c) => c.m === "buyers.range")

    expect(result.size).toBe(2500)
    expect(orderIndex).toBeGreaterThanOrEqual(0)
    expect(firstRangeIndex).toBeGreaterThan(orderIndex)
  })
})

// ===========================================================================
// Phase 3c-i — channel-correct eligibility universe
// ===========================================================================

describe("resolveEligibleUniverse — channel-correct suppression", () => {
  // A pool of buyers with assorted consent flags. The mock applies the recorded
  // eq/is/not filters to this pool, simulating the DB predicate.
  const POOL = [
    // email-suppressed BUT sms-opted-in with a phone → must be SMS-eligible.
    { id: "sms-ok", org_id: "org-1", deleted_at: null, can_receive_sms: true, sms_suppressed: false, phone: "+15125550001", email_suppressed: true, can_receive_email: true, email: "a@x.com" },
    // STOP'd → never SMS-eligible.
    { id: "stop", org_id: "org-1", deleted_at: null, can_receive_sms: false, sms_suppressed: false, phone: "+15125550002" },
    // sms-suppressed → excluded.
    { id: "sms-supp", org_id: "org-1", deleted_at: null, can_receive_sms: true, sms_suppressed: true, phone: "+15125550003" },
    // no phone → excluded from SMS.
    { id: "no-phone", org_id: "org-1", deleted_at: null, can_receive_sms: true, sms_suppressed: false, phone: null },
    // clean email buyer → email-eligible.
    { id: "email-ok", org_id: "org-1", deleted_at: null, email_suppressed: false, can_receive_email: true, email: "b@x.com" },
    // email-suppressed → excluded from email.
    { id: "email-supp", org_id: "org-1", deleted_at: null, email_suppressed: true, can_receive_email: true, email: "c@x.com" },
  ]

  const applyFilters = (state: QueryState) => {
    let out = POOL
    for (const c of state.calls) {
      if (c.m === "eq") out = out.filter((r: any) => r[c.args[0]] === c.args[1])
      else if (c.m === "is") out = out.filter((r: any) => r[c.args[0]] === c.args[1])
      else if (c.m === "not" && c.args[1] === "is" && c.args[2] === null)
        out = out.filter((r: any) => r[c.args[0]] != null)
    }
    return out.map((r: any) => ({ id: r.id }))
  }

  test("sms: includes an email-suppressed + sms-opted-in buyer; excludes STOP'd / sms-suppressed / no-phone", async () => {
    const { client } = makeClient((s) => (s.table === "buyers" ? applyFilters(s) : []))
    const result = await resolveEligibleUniverse(baseCtx({ supabase: client, channel: "sms" }))
    expect([...result].sort()).toEqual(["sms-ok"])
    expect(result.has("stop")).toBe(false)
    expect(result.has("sms-supp")).toBe(false)
    expect(result.has("no-phone")).toBe(false)
  })

  test("email: unchanged — excludes email-suppressed", async () => {
    const { client } = makeClient((s) => (s.table === "buyers" ? applyFilters(s) : []))
    const result = await resolveEligibleUniverse(baseCtx({ supabase: client, channel: "email" }))
    expect([...result].sort()).toEqual(["email-ok"])
    expect(result.has("email-supp")).toBe(false)
  })
})
