// Segment engine types — the shared vocabulary for the rule tree, the resolver,
// and (in Phase 2) the builder UI. Kept dependency-free so it can be imported
// from client and server alike.

export type SegmentMatch = "all" | "any"

export type AttributeOperator =
  | "is" | "is_not"
  | "contains" | "not_contains"        // text[] overlap / not-overlap, or text ilike
  | "gte" | "lte" | "eq"
  | "between"
  | "before" | "after" | "within_days"
  | "is_blank" | "is_not_blank"

export type AttributeField =
  | "tags" | "locations" | "property_type"        // text[] fields
  | "score" | "min_arv" | "min_gross_margin"
  | "asking_price_min" | "asking_price_max"
  | "vip" | "vetted" | "cash_buyer" | "investor" | "owner_financing" | "first_time_buyer"
  | "status" | "source" | "property_interest" | "company"
  | "mailing_state" | "mailing_city" | "mailing_zip"
  | "email" | "phone"
  | "created_at"

export interface AttributeCondition {
  kind: "attribute"
  field: AttributeField
  operator: AttributeOperator
  value?: string | number | boolean | string[] | { min?: number; max?: number } | { days?: number }
}

export type BehavioralMetric =
  | "sent" | "delivered" | "opened" | "clicked" | "replied"
  | "bounced" | "complained" | "unsubscribed"

export type BehavioralScope =
  | { type: "any_campaign" }
  | { type: "this_campaign" }                          // requires contextCampaignId at resolve time
  | { type: "specific_campaign"; campaignId: string }
  | { type: "within_days"; days: number }

export interface BehavioralCondition {
  kind: "behavioral"
  metric: BehavioralMetric
  operator: "did" | "did_not"
  scope: BehavioralScope
  channel?: "email" | "sms"                            // optional: restrict to campaigns of this channel
}

export type SegmentCondition = AttributeCondition | BehavioralCondition

export interface SegmentDefinition {
  match: SegmentMatch
  conditions: SegmentCondition[]
}

export interface ResolveContext {
  supabase: any              // an authenticated Supabase client (RLS-scoped) OR supabaseAdmin
  orgId: string
  channel: "email" | "sms"   // drives channel-eligibility intersection
  contextCampaignId?: string // required if any behavioral scope is { type: "this_campaign" }
}
