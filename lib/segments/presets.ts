// Declarative preset catalog — one place that defines the audience "chips".
// Each preset builds a SegmentDefinition that is valid per the field/metric
// catalogs (proven in tests via validateDefinition). Behavioral presets set NO
// `channel`, so they inherit channel-locking from the resolver (Phase 2.5):
// they resolve against the campaign's own channel automatically.

import type { SegmentDefinition } from "./types"

export interface SegmentPreset {
  id: string
  label: string                         // chip text, sentence case
  description?: string                  // optional tooltip
  channels: ("email" | "sms")[]         // which campaigns this chip shows on
  build: (ctx?: { contextCampaignId?: string }) => SegmentDefinition
}

// n:1 = "your most recent campaign on this channel". No campaign id is hardcoded.
const lastN = (n: number) => ({ type: "last_n_campaigns", n }) as const

export const CORE_PRESETS: SegmentPreset[] = [
  {
    id: "everyone_reachable",
    label: "Everyone reachable",
    description: "All buyers who can receive this channel.",
    channels: ["email", "sms"],
    build: () => ({ match: "all", conditions: [] }),
  },
  {
    id: "didnt_open_last",
    label: "Didn't open last",
    description: "Was sent your most recent email but didn't open it.",
    channels: ["email"],
    build: () => ({
      match: "all",
      conditions: [{ kind: "behavioral", metric: "opened", operator: "did_not", scope: lastN(1) }],
    }),
  },
  {
    id: "opened_last",
    label: "Opened last",
    description: "Opened your most recent email.",
    channels: ["email"],
    build: () => ({
      match: "all",
      conditions: [{ kind: "behavioral", metric: "opened", operator: "did", scope: lastN(1) }],
    }),
  },
  {
    id: "clicked_last",
    label: "Clicked last",
    description: "Clicked a link in your most recent campaign.",
    channels: ["email", "sms"],
    build: () => ({
      match: "all",
      conditions: [{ kind: "behavioral", metric: "clicked", operator: "did", scope: lastN(1) }],
    }),
  },
  {
    id: "didnt_click_last",
    label: "Didn't click last",
    description: "Was sent your most recent campaign but didn't click.",
    channels: ["email", "sms"],
    build: () => ({
      match: "all",
      conditions: [{ kind: "behavioral", metric: "clicked", operator: "did_not", scope: lastN(1) }],
    }),
  },
  {
    id: "didnt_reply_last",
    label: "Didn't reply last",
    description: "Was sent your most recent text but didn't reply.",
    channels: ["sms"],
    build: () => ({
      match: "all",
      conditions: [{ kind: "behavioral", metric: "replied", operator: "did_not", scope: lastN(1) }],
    }),
  },
  {
    id: "new_buyers_30d",
    label: "New buyers · 30 days",
    description: "Buyers added in the last 30 days.",
    channels: ["email", "sms"],
    build: () => ({
      match: "all",
      conditions: [{ kind: "attribute", field: "created_at", operator: "within_days", value: { days: 30 } }],
    }),
  },
  {
    id: "vip_buyers",
    label: "VIP buyers",
    channels: ["email", "sms"],
    build: () => ({
      match: "all",
      conditions: [{ kind: "attribute", field: "vip", operator: "is", value: true }],
    }),
  },
  {
    id: "cash_buyers",
    label: "Cash buyers",
    channels: ["email", "sms"],
    build: () => ({
      match: "all",
      conditions: [{ kind: "attribute", field: "cash_buyer", operator: "is", value: true }],
    }),
  },
  {
    id: "engaged_90d",
    label: "Engaged · 90 days",
    description: "Opened or clicked anything in the last 90 days.",
    channels: ["email", "sms"],
    build: () => ({
      match: "any",
      conditions: [
        { kind: "behavioral", metric: "opened", operator: "did", scope: { type: "within_days", days: 90 } },
        { kind: "behavioral", metric: "clicked", operator: "did", scope: { type: "within_days", days: 90 } },
      ],
    }),
  },
  {
    id: "cold_90d",
    label: "Cold · 90 days",
    description: "Was sent in the last 90 days but never opened or clicked.",
    channels: ["email"],
    build: () => ({
      match: "all",
      conditions: [
        { kind: "behavioral", metric: "sent", operator: "did", scope: { type: "within_days", days: 90 } },
        { kind: "behavioral", metric: "opened", operator: "did_not", scope: { type: "within_days", days: 90 } },
        { kind: "behavioral", metric: "clicked", operator: "did_not", scope: { type: "within_days", days: 90 } },
      ],
    }),
  },
]

// Defined but NOT surfaced yet — moving an entry into CORE_PRESETS is a one-line
// change to enable it in the picker.
export const OPTIONAL_PRESETS: SegmentPreset[] = [
  {
    id: "never_engaged",
    label: "Never engaged",
    description: "Never opened any campaign.",
    channels: ["email"],
    build: () => ({
      match: "all",
      conditions: [{ kind: "behavioral", metric: "opened", operator: "did_not", scope: { type: "any_campaign" } }],
    }),
  },
  {
    id: "was_not_sent_last",
    label: "Wasn't sent last",
    description: "Was not included in your most recent campaign.",
    channels: ["email", "sms"],
    build: () => ({
      match: "all",
      conditions: [{ kind: "behavioral", metric: "sent", operator: "did_not", scope: lastN(1) }],
    }),
  },
  {
    id: "vip_cash_buyers",
    label: "VIP cash buyers",
    channels: ["email", "sms"],
    build: () => ({
      match: "all",
      conditions: [
        { kind: "attribute", field: "vip", operator: "is", value: true },
        { kind: "attribute", field: "cash_buyer", operator: "is", value: true },
      ],
    }),
  },
  {
    id: "sms_reachable_never_texted",
    label: "Reachable, never texted",
    description: "Has a phone but was never sent a text.",
    channels: ["sms"],
    build: () => ({
      match: "all",
      conditions: [
        { kind: "attribute", field: "phone", operator: "is_not_blank" },
        { kind: "behavioral", metric: "sent", operator: "did_not", scope: { type: "any_campaign" } },
      ],
    }),
  },
]

// CORE presets relevant to a given channel.
export function presetsForChannel(channel: "email" | "sms"): SegmentPreset[] {
  return CORE_PRESETS.filter((p) => p.channels.includes(channel))
}
