"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import ConditionRow from "./condition-row"
import AddConditionMenu from "./add-condition-menu"
import SegmentCountBadge from "./segment-count-badge"
import { ATTRIBUTE_CATALOG, BEHAVIORAL_CATALOG } from "@/lib/segments/catalog"
import type { SegmentCondition, SegmentDefinition, SegmentMatch } from "@/lib/segments/types"

interface SegmentBuilderProps {
  value: SegmentDefinition
  onChange: (def: SegmentDefinition) => void
  channel: "email" | "sms" | "both"
  contextCampaignId?: string
  /** Library uses false; the campaign compose step (Phase 3) passes true. */
  allowThisCampaign?: boolean
}

export default function SegmentBuilder({
  value,
  onChange,
  channel,
  contextCampaignId,
  allowThisCampaign = false,
}: SegmentBuilderProps) {
  const conditions = value?.conditions ?? []
  const match: SegmentMatch = value?.match ?? "all"

  // Everything the builder offers is derived from the catalogs — adding a field
  // or metric there automatically surfaces it here. These counts make that
  // explicit (and scope behavioral metrics to the active channel).
  const attributeCount = ATTRIBUTE_CATALOG.length
  const activityCount =
    channel === "both"
      ? BEHAVIORAL_CATALOG.length
      : BEHAVIORAL_CATALOG.filter((m) => m.channels.includes(channel)).length

  const setMatch = (m: SegmentMatch) => onChange({ ...value, match: m })
  const addCondition = (cond: SegmentCondition) =>
    onChange({ ...value, conditions: [...conditions, cond] })
  const updateCondition = (index: number, cond: SegmentCondition) =>
    onChange({ ...value, conditions: conditions.map((c, i) => (i === index ? cond : c)) })
  const removeCondition = (index: number) =>
    onChange({ ...value, conditions: conditions.filter((_, i) => i !== index) })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Buyers match</span>
        <Select value={match} onValueChange={(m) => setMatch(m as SegmentMatch)}>
          <SelectTrigger className="w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="any">Any</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">of the following conditions</span>
      </div>

      {conditions.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No conditions yet — this matches everyone reachable. Add a condition to narrow the audience.
          <span className="mt-1 block text-xs">
            {attributeCount} attributes · {activityCount} activity signals available
          </span>
        </p>
      ) : (
        <div className="space-y-2">
          {conditions.map((cond, i) => (
            <ConditionRow
              key={i}
              condition={cond}
              channel={channel}
              allowThisCampaign={allowThisCampaign}
              onChange={(c) => updateCondition(i, c)}
              onRemove={() => removeCondition(i)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <AddConditionMenu channel={channel} onAdd={addCondition} />
        <SegmentCountBadge definition={value} channel={channel} contextCampaignId={contextCampaignId} />
      </div>
    </div>
  )
}
