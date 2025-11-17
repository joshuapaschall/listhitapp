"use client"

import type { TimeRange } from "@/services/dashboard-service"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface ToggleTimeRangeProps {
  value: TimeRange
  onChange: (value: TimeRange) => void
}

export default function ToggleTimeRange({ value, onChange }: ToggleTimeRangeProps) {
  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as TimeRange)}
        className="p-2"
      >
        <ToggleGroupItem value="today">Today</ToggleGroupItem>
        <ToggleGroupItem value="week">This Week</ToggleGroupItem>
        <ToggleGroupItem value="month">This Month</ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}
