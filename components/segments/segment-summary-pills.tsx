"use client"

import { Badge } from "@/components/ui/badge"
import { describeCondition } from "@/lib/segments/condition-utils"
import type { SegmentDefinition } from "@/lib/segments/types"

interface SegmentSummaryPillsProps {
  definition: SegmentDefinition
  /** Cap pills shown; remainder collapses into a "+N" pill. */
  max?: number
  groupNameById?: Record<string, string>
}

export default function SegmentSummaryPills({ definition, max = 6, groupNameById }: SegmentSummaryPillsProps) {
  const conditions = definition?.conditions ?? []

  if (conditions.length === 0) {
    return <span className="text-xs text-muted-foreground">Everyone reachable</span>
  }

  const joiner = definition.match === "all" ? "AND" : "OR"
  const shown = conditions.slice(0, max)
  const extra = conditions.length - shown.length

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((cond, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className="text-[10px] font-semibold uppercase text-muted-foreground">{joiner}</span>}
          <Badge variant="secondary" className="font-normal">
            {describeCondition(cond, { groupNameById })}
          </Badge>
        </span>
      ))}
      {extra > 0 && (
        <Badge variant="outline" className="font-normal">
          +{extra} more
        </Badge>
      )}
    </div>
  )
}
