"use client"

import { Trash2, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import ValueInput from "./value-input"
import { OptionsCombobox } from "./options-combobox"
import {
  ATTRIBUTE_CATALOG,
  ATTRIBUTE_BY_FIELD,
  BEHAVIORAL_CATALOG,
  BEHAVIORAL_BY_METRIC,
} from "@/lib/segments/catalog"
import {
  defaultAttributeCondition,
  defaultBehavioralCondition,
  didNotHelper,
  isConditionComplete,
} from "@/lib/segments/condition-utils"
import type { AttributeFieldSpec } from "@/lib/segments/catalog"
import type {
  AttributeCondition,
  AttributeField,
  AttributeOperator,
  BehavioralCondition,
  BehavioralMetric,
  BehavioralScope,
  SegmentCondition,
} from "@/lib/segments/types"

interface ConditionRowProps {
  condition: SegmentCondition
  channel: "email" | "sms" | "both"
  allowThisCampaign?: boolean
  onChange: (cond: SegmentCondition) => void
  onRemove: () => void
}

const OPERATOR_LABELS: Record<AttributeOperator, string> = {
  is: "is",
  is_not: "is not",
  contains: "includes any of",
  contains_all: "has all of",
  not_contains: "excludes",
  gte: "at least",
  lte: "at most",
  eq: "equals",
  between: "between",
  before: "before",
  after: "after",
  within_days: "within the last",
  is_blank: "is blank",
  is_not_blank: "is set",
}

const VALUELESS: AttributeOperator[] = ["is_blank", "is_not_blank"]

function metricEnabled(channels: ("email" | "sms")[], channel: "email" | "sms" | "both") {
  return channel === "both" || channels.includes(channel)
}

function valueForOperator(
  spec: AttributeFieldSpec,
  newOp: AttributeOperator,
  oldValue: AttributeCondition["value"],
): AttributeCondition["value"] {
  if (VALUELESS.includes(newOp) || spec.valueType === "boolean") return undefined
  if (newOp === "between") {
    return oldValue && typeof oldValue === "object" && !Array.isArray(oldValue) ? oldValue : {}
  }
  if (spec.valueType === "date" && newOp === "within_days") return { days: 30 }
  // Switching to a scalar operator from a structured one drops the old shape.
  if (oldValue && typeof oldValue === "object" && !Array.isArray(oldValue)) return undefined
  return oldValue
}

function AttributeRow({
  condition,
  onChange,
}: {
  condition: AttributeCondition
  onChange: (c: SegmentCondition) => void
}) {
  const spec = ATTRIBUTE_BY_FIELD[condition.field]

  return (
    <>
      <Select
        value={condition.field}
        onValueChange={(field) => onChange(defaultAttributeCondition(field as AttributeField))}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Attribute</SelectLabel>
            {ATTRIBUTE_CATALOG.map((s) => (
              <SelectItem key={s.field} value={s.field}>
                {s.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {spec && (
        <Select
          value={condition.operator}
          onValueChange={(op) =>
            onChange({
              ...condition,
              operator: op as AttributeOperator,
              value: valueForOperator(spec, op as AttributeOperator, condition.value),
            })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {spec.operators.map((op) => (
              <SelectItem key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {spec && !VALUELESS.includes(condition.operator) && spec.valueType !== "boolean" && (
        <div className="min-w-[220px] flex-1">
          <ValueInput
            spec={spec}
            operator={condition.operator}
            value={condition.value}
            onChange={(value) => onChange({ ...condition, value })}
          />
        </div>
      )}
    </>
  )
}

function BehavioralRow({
  condition,
  channel,
  allowThisCampaign,
  onChange,
}: {
  condition: BehavioralCondition
  channel: "email" | "sms" | "both"
  allowThisCampaign?: boolean
  onChange: (c: SegmentCondition) => void
}) {
  const scope = condition.scope
  const helper = didNotHelper(condition)
  const orphanThisCampaign = scope.type === "this_campaign" && !allowThisCampaign

  const setScopeType = (type: BehavioralScope["type"]) => {
    let next: BehavioralScope
    if (type === "specific_campaign") next = { type, campaignId: "" }
    else if (type === "within_days") next = { type, days: 30 }
    else if (type === "last_n_campaigns") next = { type, n: 5 }
    else if (type === "this_campaign") next = { type }
    else next = { type: "any_campaign" }
    onChange({ ...condition, scope: next })
  }

  // Channel override is only useful when there's something to choose: the builder
  // spans both channels, or this metric is meaningful on more than one channel.
  const metricChannels = BEHAVIORAL_BY_METRIC[condition.metric]?.channels ?? []
  const showChannelOverride = channel === "both" || metricChannels.length > 1

  return (
    <>
      <Select
        value={condition.metric}
        onValueChange={(m) =>
          onChange({
            ...defaultBehavioralCondition(m as BehavioralMetric),
            operator: condition.operator,
            channel: condition.channel,
          })
        }
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Campaign activity</SelectLabel>
            {BEHAVIORAL_CATALOG.map((s) => {
              const enabled = metricEnabled(s.channels, channel)
              return (
                <SelectItem key={s.metric} value={s.metric} disabled={!enabled}>
                  <span className="capitalize">{s.label}</span>
                  {!enabled ? ` (${s.channels.join("/")} only)` : ""}
                </SelectItem>
              )
            })}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        value={condition.operator}
        onValueChange={(op) => onChange({ ...condition, operator: op as "did" | "did_not" })}
      >
        <SelectTrigger className="w-[110px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="did">did</SelectItem>
          <SelectItem value="did_not">did not</SelectItem>
        </SelectContent>
      </Select>

      {orphanThisCampaign ? (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          resolves against the campaign it&apos;s used in
        </span>
      ) : (
        <Select value={scope.type} onValueChange={(t) => setScopeType(t as BehavioralScope["type"])}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any_campaign">any campaign</SelectItem>
            <SelectItem value="specific_campaign">a specific campaign</SelectItem>
            <SelectItem value="within_days">in the last N days</SelectItem>
            <SelectItem value="last_n_campaigns">any of the last N campaigns</SelectItem>
            {allowThisCampaign && <SelectItem value="this_campaign">this campaign</SelectItem>}
          </SelectContent>
        </Select>
      )}

      {scope.type === "specific_campaign" && (
        <div className="min-w-[220px] flex-1">
          <OptionsCombobox
            field="campaigns"
            value={scope.campaignId}
            onChange={(campaignId) => onChange({ ...condition, scope: { type: "specific_campaign", campaignId } })}
            placeholder="Pick a campaign…"
            missingLabel={() => "(deleted campaign)"}
          />
        </div>
      )}

      {scope.type === "within_days" && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            className="w-24"
            value={scope.days}
            onChange={(e) => {
              const days = Math.max(1, Number(e.target.value) || 1)
              onChange({ ...condition, scope: { type: "within_days", days } })
            }}
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      )}

      {scope.type === "last_n_campaigns" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">last</span>
          <Input
            type="number"
            min={1}
            className="w-20"
            value={scope.n}
            onChange={(e) => {
              const n = Math.max(1, Number(e.target.value) || 1)
              onChange({ ...condition, scope: { type: "last_n_campaigns", n } })
            }}
          />
          <span className="text-sm text-muted-foreground">campaigns</span>
        </div>
      )}

      {/* Channel override. Unset = the channel being resolved (2.5 semantics);
          "any" = both channels. Subordinate to metric/operator/scope. */}
      {showChannelOverride && (
        <Select
          value={condition.channel ?? "this"}
          onValueChange={(c) =>
            onChange({ ...condition, channel: c === "this" ? undefined : (c as "email" | "sms" | "any") })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this">This channel</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="any">Any channel</SelectItem>
          </SelectContent>
        </Select>
      )}

      {helper && (
        <span className="basis-full text-xs text-muted-foreground">{helper}</span>
      )}
      {BEHAVIORAL_BY_METRIC[condition.metric] === undefined && (
        <span className="basis-full text-xs text-destructive">Unknown metric</span>
      )}
    </>
  )
}

export default function ConditionRow({
  condition,
  channel,
  allowThisCampaign,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const complete = isConditionComplete(condition)

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3",
        !complete && "border-amber-300 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20",
      )}
    >
      {condition.kind === "attribute" ? (
        <AttributeRow condition={condition} onChange={onChange} />
      ) : (
        <BehavioralRow
          condition={condition}
          channel={channel}
          allowThisCampaign={allowThisCampaign}
          onChange={onChange}
        />
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {!complete && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Finish this condition to include it in the count.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove condition">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
