// Single source of truth describing every queryable attribute field and
// behavioral metric. Drives engine validation now (lib/segments/resolver.ts)
// and the Phase 2 builder UI later. Column names are the EXACT, verified
// columns on `buyers` / `campaign_recipients` — do not invent columns.

import type {
  AttributeField,
  AttributeOperator,
  BehavioralMetric,
} from "./types"

export interface AttributeFieldSpec {
  field: AttributeField
  label: string                 // e.g. "Tags", "Lead score", "VIP"
  column: string                // exact buyers column
  valueType: "text" | "number" | "boolean" | "text[]" | "date"
  operators: AttributeOperator[]
}

// Operator sets keyed by value type, per the task spec.
const TEXT_ARRAY_OPS: AttributeOperator[] = [
  "contains", "contains_all", "not_contains", "is_blank", "is_not_blank",
]
const NUMBER_OPS: AttributeOperator[] = [
  "gte", "lte", "eq", "between", "is_blank", "is_not_blank",
]
const BOOLEAN_OPS: AttributeOperator[] = ["is", "is_not"]
const TEXT_OPS: AttributeOperator[] = [
  "is", "is_not", "contains", "not_contains", "is_blank", "is_not_blank",
]
const DATE_OPS: AttributeOperator[] = ["before", "after", "within_days", "between"]

export const ATTRIBUTE_CATALOG: AttributeFieldSpec[] = [
  // text[] fields
  { field: "tags", label: "Tags", column: "tags", valueType: "text[]", operators: TEXT_ARRAY_OPS },
  { field: "locations", label: "Locations", column: "locations", valueType: "text[]", operators: TEXT_ARRAY_OPS },
  { field: "property_type", label: "Property type", column: "property_type", valueType: "text[]", operators: TEXT_ARRAY_OPS },

  // numbers
  { field: "score", label: "Lead score", column: "score", valueType: "number", operators: NUMBER_OPS },
  { field: "min_arv", label: "Min ARV", column: "min_arv", valueType: "number", operators: NUMBER_OPS },
  { field: "min_gross_margin", label: "Min gross margin", column: "min_gross_margin", valueType: "number", operators: NUMBER_OPS },
  { field: "asking_price_min", label: "Asking price (min)", column: "asking_price_min", valueType: "number", operators: NUMBER_OPS },
  { field: "asking_price_max", label: "Asking price (max)", column: "asking_price_max", valueType: "number", operators: NUMBER_OPS },

  // booleans
  { field: "vip", label: "VIP", column: "vip", valueType: "boolean", operators: BOOLEAN_OPS },
  { field: "vetted", label: "Vetted", column: "vetted", valueType: "boolean", operators: BOOLEAN_OPS },
  { field: "cash_buyer", label: "Cash buyer", column: "cash_buyer", valueType: "boolean", operators: BOOLEAN_OPS },
  { field: "investor", label: "Investor", column: "investor", valueType: "boolean", operators: BOOLEAN_OPS },
  { field: "owner_financing", label: "Owner financing", column: "owner_financing", valueType: "boolean", operators: BOOLEAN_OPS },
  { field: "first_time_buyer", label: "First-time buyer", column: "first_time_buyer", valueType: "boolean", operators: BOOLEAN_OPS },

  // text
  { field: "status", label: "Status", column: "status", valueType: "text", operators: TEXT_OPS },
  { field: "source", label: "Source", column: "source", valueType: "text", operators: TEXT_OPS },
  { field: "property_interest", label: "Property interest", column: "property_interest", valueType: "text", operators: TEXT_OPS },
  { field: "company", label: "Company", column: "company", valueType: "text", operators: TEXT_OPS },
  { field: "mailing_state", label: "Mailing state", column: "mailing_state", valueType: "text", operators: TEXT_OPS },
  { field: "mailing_city", label: "Mailing city", column: "mailing_city", valueType: "text", operators: TEXT_OPS },
  { field: "mailing_zip", label: "Mailing ZIP", column: "mailing_zip", valueType: "text", operators: TEXT_OPS },
  { field: "email", label: "Email", column: "email", valueType: "text", operators: TEXT_OPS },
  { field: "phone", label: "Phone", column: "phone", valueType: "text", operators: TEXT_OPS },

  // date
  { field: "created_at", label: "Created date", column: "created_at", valueType: "date", operators: DATE_OPS },
]

export interface BehavioralMetricSpec {
  metric: BehavioralMetric
  label: string                 // e.g. "was sent", "opened", "replied"
  column: string                // exact campaign_recipients column ("sent_at", "opened_at", ...)
  channels: ("email" | "sms")[] // opened→email, replied→sms, sent/delivered/clicked/unsubscribed→both, bounced/complained→email
}

export const BEHAVIORAL_CATALOG: BehavioralMetricSpec[] = [
  { metric: "sent", label: "was sent", column: "sent_at", channels: ["email", "sms"] },
  { metric: "delivered", label: "was delivered", column: "delivered_at", channels: ["email", "sms"] },
  { metric: "opened", label: "opened", column: "opened_at", channels: ["email"] },
  { metric: "clicked", label: "clicked", column: "clicked_at", channels: ["email", "sms"] },
  { metric: "replied", label: "replied", column: "replied_at", channels: ["sms"] },
  { metric: "bounced", label: "bounced", column: "bounced_at", channels: ["email"] },
  { metric: "complained", label: "complained", column: "complained_at", channels: ["email"] },
  { metric: "unsubscribed", label: "unsubscribed", column: "unsubscribed_at", channels: ["email", "sms"] },
]

// Lookups used by the resolver and validation.
export const ATTRIBUTE_BY_FIELD: Record<string, AttributeFieldSpec> = Object.fromEntries(
  ATTRIBUTE_CATALOG.map((spec) => [spec.field, spec]),
)

export const BEHAVIORAL_BY_METRIC: Record<string, BehavioralMetricSpec> = Object.fromEntries(
  BEHAVIORAL_CATALOG.map((spec) => [spec.metric, spec]),
)
