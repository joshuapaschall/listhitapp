// Catalog-driven helpers shared by the builder UI: default-condition factories,
// completeness checks, and plain-English descriptions. All labels/operators are
// derived from the catalogs — nothing field-specific is hardcoded here.

import { ATTRIBUTE_BY_FIELD, BEHAVIORAL_BY_METRIC } from "./catalog"
import type {
  AttributeCondition,
  AttributeField,
  AttributeOperator,
  BehavioralCondition,
  BehavioralMetric,
  SegmentCondition,
} from "./types"

export function defaultAttributeCondition(field: AttributeField): AttributeCondition {
  const spec = ATTRIBUTE_BY_FIELD[field]
  const operator = (spec?.operators[0] ?? "is") as AttributeOperator
  let value: AttributeCondition["value"]
  switch (spec?.valueType) {
    case "text[]":
      value = []
      break
    case "boolean":
      value = true
      break
    case "number":
      value = operator === "between" ? {} : undefined
      break
    case "date":
      value = operator === "within_days" ? { days: 30 } : operator === "between" ? {} : undefined
      break
    default:
      value = ""
  }
  return { kind: "attribute", field, operator, value }
}

export function defaultBehavioralCondition(metric: BehavioralMetric): BehavioralCondition {
  return { kind: "behavioral", metric, operator: "did", scope: { type: "any_campaign" } }
}

const VALUELESS_OPERATORS: AttributeOperator[] = ["is_blank", "is_not_blank"]

function isFiniteNumber(v: unknown): boolean {
  return typeof v === "number" ? Number.isFinite(v) : v != null && v !== "" && Number.isFinite(Number(v))
}

// Is the condition fully specified enough to send to the resolver? Incomplete
// conditions are excluded from the live count and block Save.
export function isConditionComplete(cond: SegmentCondition): boolean {
  if (cond.kind === "attribute") {
    const spec = ATTRIBUTE_BY_FIELD[cond.field]
    if (!spec) return false
    if (VALUELESS_OPERATORS.includes(cond.operator)) return true
    if (spec.valueType === "boolean") return true

    const v = cond.value
    switch (spec.valueType) {
      case "text[]":
        return Array.isArray(v) && v.length > 0
      case "text":
        return typeof v === "string" && v.trim().length > 0
      case "number":
        if (cond.operator === "between") {
          const r = (v ?? {}) as { min?: unknown; max?: unknown }
          return isFiniteNumber(r.min) || isFiniteNumber(r.max)
        }
        return isFiniteNumber(v)
      case "date":
        if (cond.operator === "within_days") {
          const days = ((v ?? {}) as { days?: unknown }).days
          return isFiniteNumber(days) && Number(days) >= 1
        }
        if (cond.operator === "between") {
          const r = (v ?? {}) as { min?: unknown; max?: unknown }
          return Boolean(r.min) || Boolean(r.max)
        }
        return Boolean(v)
      default:
        return false
    }
  }

  // behavioral
  const scope = cond.scope
  if (!scope) return false
  if (scope.type === "specific_campaign") return Boolean(scope.campaignId)
  if (scope.type === "within_days") return isFiniteNumber(scope.days) && Number(scope.days) >= 1
  if (scope.type === "last_n_campaigns") return isFiniteNumber(scope.n) && Number(scope.n) >= 1
  return true
}

const OPERATOR_WORDS: Partial<Record<AttributeOperator, string>> = {
  is: "is",
  is_not: "is not",
  contains: "includes",
  not_contains: "excludes",
  gte: "≥",
  lte: "≤",
  eq: "=",
  between: "between",
  before: "before",
  after: "after",
  within_days: "in last",
  is_blank: "is blank",
  is_not_blank: "is set",
}

function formatValue(cond: AttributeCondition): string {
  const v = cond.value
  if (Array.isArray(v)) return v.join(", ")
  if (v && typeof v === "object") {
    if ("days" in v) return `${(v as any).days} days`
    const r = v as { min?: unknown; max?: unknown }
    return [r.min, r.max].filter((x) => x != null && x !== "").join("–")
  }
  if (typeof v === "boolean") return v ? "yes" : "no"
  return v == null ? "" : String(v)
}

// Short plain-English description for summary pills / inline labels.
export function describeCondition(cond: SegmentCondition): string {
  if (cond.kind === "attribute") {
    const spec = ATTRIBUTE_BY_FIELD[cond.field]
    const label = spec?.label ?? cond.field
    if (spec?.valueType === "boolean") {
      return `${label} ${cond.operator === "is_not" ? "is not" : "is"} yes`
    }
    if (VALUELESS_OPERATORS.includes(cond.operator)) {
      return `${label} ${OPERATOR_WORDS[cond.operator]}`
    }
    const word = OPERATOR_WORDS[cond.operator] ?? cond.operator
    return `${label} ${word} ${formatValue(cond)}`.trim()
  }

  const spec = BEHAVIORAL_BY_METRIC[cond.metric]
  const verb = spec?.label ?? cond.metric
  const did = cond.operator === "did_not" ? `didn't ${stripWas(verb)}` : verb
  const scopeText = describeScope(cond)
  // Unset channel = the channel being resolved (implied) → render nothing.
  const channelText =
    cond.channel === "any" ? " (any channel)" : cond.channel ? ` (${cond.channel})` : ""
  return `${did} · ${scopeText}${channelText}`
}

function stripWas(label: string): string {
  // "was sent" → "sent"; "opened" → "open"-ish; keep simple/readable.
  return label.replace(/^was\s+/, "")
}

export function describeScope(cond: BehavioralCondition): string {
  const scope = cond.scope
  switch (scope.type) {
    case "any_campaign":
      return "any campaign"
    case "this_campaign":
      return "this campaign"
    case "specific_campaign":
      return "a specific campaign"
    case "within_days":
      return `in last ${scope.days} days`
    case "last_n_campaigns":
      return `last ${scope.n} campaigns`
    default:
      return ""
  }
}

// did_not + an engagement metric ("opened"/"clicked"/...) → the "was sent, but
// did not X" clarification. Returns null when not applicable.
export function didNotHelper(cond: BehavioralCondition): string | null {
  if (cond.operator !== "did_not") return null
  if (cond.metric === "sent") return null
  const spec = BEHAVIORAL_BY_METRIC[cond.metric]
  const verb = spec ? stripWas(spec.label) : cond.metric
  return `= was sent, but did not ${verb}`
}
