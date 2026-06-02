import { ChevronRight } from "lucide-react"

import { Card } from "@/components/ui/card"
import type { DealFunnel } from "@/services/dashboard-service"

interface DashboardFunnelProps {
  data: DealFunnel
}

const MIN_BAR_HEIGHT = 36
const MAX_BAR_HEIGHT = 64

export default function DashboardFunnel({ data }: DashboardFunnelProps) {
  const stages = [
    { label: "Buyers", value: data.buyers, className: "bg-brand/10 text-brand" },
    { label: "Showings", value: data.showings, className: "bg-brand/35 text-brand" },
    { label: "Offers", value: data.offers, className: "bg-brand/65 text-brand-foreground" },
    { label: "Closed", value: data.closed, className: "bg-brand text-brand-foreground" },
  ]
  const maxValue = Math.max(...stages.map((stage) => stage.value), 0)

  return (
    <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="text-sm font-semibold text-foreground">Deal pipeline</div>
      <div className="mb-4 mt-0.5 text-xs text-muted-foreground">
        From your buyer list to closed deals
      </div>
      <div className="flex items-end gap-2">
        {stages.map((stage, index) => {
          const height = maxValue === 0
            ? MIN_BAR_HEIGHT
            : MIN_BAR_HEIGHT + (stage.value / maxValue) * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT)

          return (
            <div key={stage.label} className="flex flex-1 items-end gap-2">
              <div className="flex flex-1 flex-col items-center justify-end">
                <div
                  className={`flex w-full items-center justify-center rounded-xl ${stage.className}`}
                  style={{ height: `${height}px` }}
                >
                  <span className="text-lg font-[650] tabular-nums">
                    {stage.value.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-medium text-muted-foreground">
                  {stage.label}
                </div>
              </div>
              {index < stages.length - 1 ? (
                <ChevronRight
                  aria-hidden="true"
                  className="mb-[34px] h-4 w-4 shrink-0 text-muted-foreground/40"
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
