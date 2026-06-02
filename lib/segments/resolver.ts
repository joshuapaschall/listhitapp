// Segment resolver engine.
//
// Turns a SegmentDefinition rule tree into the set of buyer ids we would
// actually send to, for a given channel. Two condition families:
//   - attribute  → query `buyers` (org-scoped, not deleted)
//   - behavioral → query `campaign_recipients` (org-scoped via campaigns)
// combined with AND (`all`) / OR (`any`), then ALWAYS intersected with the
// channel-eligibility/suppression universe so the resolved set equals the
// send-time audience.
//
// The combination math (intersectSets / unionSets / subtractSets / combineSets)
// is pure and unit-testable with no DB. The DB-touching resolvers accept a
// ResolveContext carrying an authenticated Supabase client.

import {
  ATTRIBUTE_BY_FIELD,
  BEHAVIORAL_BY_METRIC,
  type AttributeFieldSpec,
} from "./catalog"
import type {
  AttributeCondition,
  BehavioralCondition,
  BehavioralScope,
  ResolveContext,
  SegmentCondition,
  SegmentDefinition,
  SegmentMatch,
} from "./types"

// ---------------------------------------------------------------------------
// Pure set combinators
// ---------------------------------------------------------------------------

export function intersectSets(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set()
  // Start from the smallest set for efficiency.
  const ordered = [...sets].sort((a, b) => a.size - b.size)
  const [first, ...rest] = ordered
  const out = new Set<string>()
  for (const id of first) {
    if (rest.every((s) => s.has(id))) out.add(id)
  }
  return out
}

export function unionSets(sets: Set<string>[]): Set<string> {
  const out = new Set<string>()
  for (const s of sets) for (const id of s) out.add(id)
  return out
}

export function subtractSets(a: Set<string>, b: Set<string>): Set<string> {
  const out = new Set<string>()
  for (const id of a) if (!b.has(id)) out.add(id)
  return out
}

export function combineSets(match: SegmentMatch, sets: Set<string>[]): Set<string> {
  return match === "all" ? intersectSets(sets) : unionSets(sets)
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateDefinition(def: SegmentDefinition): void {
  if (!def || (def.match !== "all" && def.match !== "any")) {
    throw new Error(`Invalid segment definition: match must be "all" or "any"`)
  }
  if (!Array.isArray(def.conditions)) {
    throw new Error("Invalid segment definition: conditions must be an array")
  }
  for (const cond of def.conditions) {
    if (cond.kind === "attribute") {
      const spec = ATTRIBUTE_BY_FIELD[cond.field]
      if (!spec) throw new Error(`Unknown attribute field: ${String(cond.field)}`)
      if (!spec.operators.includes(cond.operator)) {
        throw new Error(`Operator "${cond.operator}" is not supported for field "${cond.field}"`)
      }
    } else if (cond.kind === "behavioral") {
      const spec = BEHAVIORAL_BY_METRIC[cond.metric]
      if (!spec) throw new Error(`Unknown behavioral metric: ${String(cond.metric)}`)
      if (cond.operator !== "did" && cond.operator !== "did_not") {
        throw new Error(`Behavioral operator must be "did" or "did_not", got "${cond.operator}"`)
      }
      const scopeType = cond.scope?.type
      if (
        scopeType !== "any_campaign" &&
        scopeType !== "this_campaign" &&
        scopeType !== "specific_campaign" &&
        scopeType !== "within_days"
      ) {
        throw new Error(`Unknown behavioral scope: ${String(scopeType)}`)
      }
    } else {
      throw new Error(`Unknown condition kind: ${String((cond as SegmentCondition as any).kind)}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 1000

// Fetch ALL rows for a query, paginating via .range() so we never silently
// truncate at Supabase's default 1000-row cap. `buildQuery` must return a FRESH
// query each call (real Postgrest builders can only be awaited once).
async function collectColumn(
  buildQuery: () => any,
  column: "id" | "buyer_id",
): Promise<Set<string>> {
  const ids = new Set<string>()
  let from = 0
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) {
      throw new Error(`Segment resolve query failed: ${error.message ?? String(error)}`)
    }
    const rows = (data ?? []) as Array<Record<string, any>>
    for (const row of rows) {
      const value = row?.[column]
      if (value != null) ids.add(String(value))
    }
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return ids
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v))
  if (value == null) return []
  return [String(value)]
}

function asRange(value: unknown): { min?: number | string; max?: number | string } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as { min?: number | string; max?: number | string }
  }
  return {}
}

function asDays(value: unknown): number {
  if (typeof value === "number") return value
  if (value && typeof value === "object" && "days" in (value as any)) {
    return Number((value as any).days)
  }
  return Number(value)
}

// Escape + wrap a text[] element list into a Postgres array literal: {"a","b"}.
function toPgArrayLiteral(values: string[]): string {
  const escaped = values.map((v) => `"${String(v).replace(/(["\\])/g, "\\$1")}"`)
  return `{${escaped.join(",")}}`
}

function buyersBase(ctx: ResolveContext): any {
  return ctx.supabase
    .from("buyers")
    .select("id")
    .eq("org_id", ctx.orgId)
    .is("deleted_at", null)
}

function applyAttributeFilter(query: any, cond: AttributeCondition, spec: AttributeFieldSpec): any {
  const col = spec.column
  const op = cond.operator

  // Blank / not-blank handling is shared across types but differs for arrays.
  if (op === "is_blank") {
    return spec.valueType === "text[]"
      ? query.or(`${col}.is.null,${col}.eq.{}`)
      : query.is(col, null)
  }
  if (op === "is_not_blank") {
    return spec.valueType === "text[]"
      ? query.not(col, "is", null).not(col, "eq", "{}")
      : query.not(col, "is", null)
  }

  switch (spec.valueType) {
    case "text[]": {
      const arr = asStringArray(cond.value)
      if (op === "contains") return query.overlaps(col, arr)
      if (op === "not_contains") return query.not(col, "ov", toPgArrayLiteral(arr))
      return query
    }
    case "text": {
      const v = cond.value as string
      if (op === "is") return query.eq(col, v)
      if (op === "is_not") return query.neq(col, v)
      if (op === "contains") return query.ilike(col, `%${v}%`)
      if (op === "not_contains") return query.not(col, "ilike", `%${v}%`)
      return query
    }
    case "number": {
      if (op === "between") {
        const { min, max } = asRange(cond.value)
        let q = query
        if (min != null) q = q.gte(col, min)
        if (max != null) q = q.lte(col, max)
        return q
      }
      const v = cond.value as number
      if (op === "gte") return query.gte(col, v)
      if (op === "lte") return query.lte(col, v)
      if (op === "eq") return query.eq(col, v)
      return query
    }
    case "boolean": {
      const truthy = Boolean(cond.value)
      if (op === "is") return query.eq(col, truthy)
      if (op === "is_not") return query.eq(col, !truthy)
      return query
    }
    case "date": {
      if (op === "before") return query.lt(col, cond.value)
      if (op === "after") return query.gt(col, cond.value)
      if (op === "within_days") return query.gte(col, daysAgoIso(asDays(cond.value)))
      if (op === "between") {
        const { min, max } = asRange(cond.value)
        let q = query
        if (min != null) q = q.gte(col, min)
        if (max != null) q = q.lte(col, max)
        return q
      }
      return query
    }
    default:
      return query
  }
}

// ---------------------------------------------------------------------------
// Attribute resolver
// ---------------------------------------------------------------------------

export async function resolveAttributeCondition(
  cond: AttributeCondition,
  ctx: ResolveContext,
): Promise<Set<string>> {
  const spec = ATTRIBUTE_BY_FIELD[cond.field]
  if (!spec) throw new Error(`Unknown attribute field: ${String(cond.field)}`)
  if (!spec.operators.includes(cond.operator)) {
    throw new Error(`Operator "${cond.operator}" is not supported for field "${cond.field}"`)
  }
  return collectColumn(() => applyAttributeFilter(buyersBase(ctx), cond, spec), "id")
}

// ---------------------------------------------------------------------------
// Behavioral resolver
// ---------------------------------------------------------------------------

// Channels this condition should look at, clamped to channels where the metric
// is meaningful. Unset channel = the channel being resolved (ctx.channel);
// "email"/"sms" = that channel; "any" = both. Clamping makes nonsensical pairs
// (e.g. `opened` on sms) resolve to empty instead of garbage.
function effectiveChannels(cond: BehavioralCondition, ctx: ResolveContext): ("email" | "sms")[] {
  const spec = BEHAVIORAL_BY_METRIC[cond.metric]
  const base: ("email" | "sms")[] =
    cond.channel === "any" ? ["email", "sms"] : [cond.channel ?? ctx.channel]
  return base.filter((c) => spec?.channels.includes(c))
}

// The ids of the most-recent N campaigns on the given channel(s).
async function lastNCampaignIds(
  ctx: ResolveContext,
  chans: ("email" | "sms")[],
  n: number,
): Promise<string[]> {
  let q = ctx.supabase
    .from("campaigns")
    .select("id, scheduled_at, created_at")
    .eq("org_id", ctx.orgId)
    .is("deleted_at", null)
  if (chans.length === 1) q = q.eq("channel", chans[0])
  else q = q.in("channel", chans)
  // most-recent first; coalesce scheduled_at → created_at
  const { data } = await q
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(Math.max(1, n))
  return (data ?? []).map((r: any) => r.id)
}

// Base query against campaign_recipients, org/channel-scoped via the joined
// campaign. `!inner` ensures the join filters rows.
function recipientsBase(ctx: ResolveContext, chans: ("email" | "sms")[]): any {
  const q = ctx.supabase
    .from("campaign_recipients")
    .select("buyer_id, campaigns!inner(org_id,deleted_at,channel)")
    .eq("campaigns.org_id", ctx.orgId)
    .is("campaigns.deleted_at", null)
  if (chans.length === 1) return q.eq("campaigns.channel", chans[0])
  return q.in("campaigns.channel", chans)
}

function applyScope(
  query: any,
  ctx: ResolveContext,
  scope: BehavioralScope,
  lastNIds: string[] | null,
): any {
  switch (scope.type) {
    case "this_campaign":
      if (!ctx.contextCampaignId) {
        throw new Error(
          'Behavioral scope "this_campaign" requires ResolveContext.contextCampaignId',
        )
      }
      return query.eq("campaign_id", ctx.contextCampaignId)
    case "specific_campaign":
      return query.eq("campaign_id", scope.campaignId)
    case "within_days":
      return query.gte("sent_at", daysAgoIso(scope.days))
    case "last_n_campaigns":
      return query.in("campaign_id", lastNIds ?? [])
    case "any_campaign":
    default:
      return query
  }
}

// Buyers with a non-null `column` among the recipient rows matching cond's scope.
async function recipientSetForColumn(
  ctx: ResolveContext,
  cond: BehavioralCondition,
  column: string,
): Promise<Set<string>> {
  const chans = effectiveChannels(cond, ctx)
  // Metric not meaningful on the resolved channel → empty, no query.
  if (chans.length === 0) return new Set<string>()

  // last_n_campaigns needs a pre-query for the campaign ids.
  let lastNIds: string[] | null = null
  if (cond.scope.type === "last_n_campaigns") {
    lastNIds = await lastNCampaignIds(ctx, chans, cond.scope.n)
    // No campaigns on the channel → empty; avoid an `.in([])` that some
    // PostgREST versions mishandle.
    if (lastNIds.length === 0) return new Set<string>()
  }

  return collectColumn(
    () => applyScope(recipientsBase(ctx, chans), ctx, cond.scope, lastNIds).not(column, "is", null),
    "buyer_id",
  )
}

export async function resolveBehavioralCondition(
  cond: BehavioralCondition,
  ctx: ResolveContext,
): Promise<Set<string>> {
  const spec = BEHAVIORAL_BY_METRIC[cond.metric]
  if (!spec) throw new Error(`Unknown behavioral metric: ${String(cond.metric)}`)

  if (cond.operator === "did") {
    return recipientSetForColumn(ctx, cond, spec.column)
  }

  // did_not
  if (cond.metric === "sent") {
    // "was not sent (in scope)" = eligible universe MINUS the sent set.
    const [universe, sentSet] = await Promise.all([
      resolveEligibleUniverse(ctx),
      recipientSetForColumn(ctx, cond, "sent_at"),
    ])
    return subtractSets(universe, sentSet)
  }

  // For every other metric: "was sent but did NOT <metric>" within the same scope.
  const [sentSet, metricSet] = await Promise.all([
    recipientSetForColumn(ctx, cond, "sent_at"),
    recipientSetForColumn(ctx, cond, spec.column),
  ])
  return subtractSets(sentSet, metricSet)
}

// ---------------------------------------------------------------------------
// Channel-eligibility universe
// ---------------------------------------------------------------------------

// The set of buyer ids that are eligible for ctx.channel — i.e. who the send
// route would actually deliver to. This mirrors app/api/campaigns/send/route.ts
// (the source of truth). See PR notes for the email_suppressed/sms_suppressed
// reconciliation against the send route.
export async function resolveEligibleUniverse(ctx: ResolveContext): Promise<Set<string>> {
  return collectColumn(() => {
    let q = ctx.supabase
      .from("buyers")
      .select("id")
      .eq("org_id", ctx.orgId)
      .is("deleted_at", null)
    if (ctx.channel === "email") {
      q = q
        .eq("email_suppressed", false)
        .eq("can_receive_email", true)
        .not("email", "is", null)
    } else {
      // SMS: mirror the send route, which applies email_suppressed=false to BOTH
      // channels (allowedQuery + recipientsQuery) and gates SMS eligibility on
      // can_receive_sms + a usable phone. It does NOT gate on sms_suppressed.
      q = q
        .eq("email_suppressed", false)
        .eq("can_receive_sms", true)
        .not("phone", "is", null)
    }
    return q
  }, "id")
}

// ---------------------------------------------------------------------------
// Top-level resolve
// ---------------------------------------------------------------------------

async function resolveCondition(cond: SegmentCondition, ctx: ResolveContext): Promise<Set<string>> {
  return cond.kind === "attribute"
    ? resolveAttributeCondition(cond, ctx)
    : resolveBehavioralCondition(cond, ctx)
}

export async function resolveSegment(
  def: SegmentDefinition,
  ctx: ResolveContext,
): Promise<Set<string>> {
  validateDefinition(def)

  // No conditions = the whole eligible audience.
  if (def.conditions.length === 0) {
    return resolveEligibleUniverse(ctx)
  }

  const sets = await Promise.all(def.conditions.map((cond) => resolveCondition(cond, ctx)))
  const combined = combineSets(def.match, sets)

  // Channel eligibility is ALWAYS the final gate.
  const universe = await resolveEligibleUniverse(ctx)
  return intersectSets([combined, universe])
}

export async function countSegment(
  def: SegmentDefinition,
  ctx: ResolveContext,
): Promise<number> {
  return (await resolveSegment(def, ctx)).size
}
