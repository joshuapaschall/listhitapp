"use client"

import ToggleTimeRange from "./ToggleTimeRange"
import type { TimeRange } from "@/services/dashboard-service"

interface DashboardHeaderProps {
  range: TimeRange
  onRangeChange: (range: TimeRange) => void
}

export default function DashboardHeader({ range, onRangeChange }: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <ToggleTimeRange value={range} onChange={onRangeChange} />
    </div>
  )
}
