import { ArrowDown } from "lucide-react"

import { Card } from "@/components/ui/card"
import type { DealFunnel } from "@/services/dashboard-service"

interface DashboardFunnelProps {
  data: DealFunnel
}

export default function DashboardFunnel({ data }: DashboardFunnelProps) {
  const stages = [
    { label: "Buyers", value: data.buyers, fill: "bg-brand/25" },
    { label: "Showings", value: data.showings, fill: "bg-brand/45" },
    { label: "Offers", value: data.offers, fill: "bg-brand/70" },
    { label: "Closed", value: data.closed, fill: "bg-brand" },
  ]
  const maxValue = Math.max(data.buyers, data.showings, data.offers, data.closed, 0)
  const overallRate = data.buyers > 0 ? Math.round((data.closed / data.buyers) * 100) : 0

  return (
    <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Deal pipeline</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            From your buyer list to closed deals
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground">Buyer → close</div>
          <div className="text-lg font-semibold text-brand tabular-nums">{overallRate}%</div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {stages.map((stage, index) => {
          const width = maxValue > 0 ? (stage.value / maxValue) * 100 : 0
          const next = stages[index + 1]
          const conversion =
            next && stage.value > 0
              ? `${Math.round((next.value / stage.value) * 100)}% advanced to ${next.label}`
              : next
              ? `— to ${next.label}`
              : null

          return (
            <div key={stage.label}>
              <div className="flex items-center gap-3">
                <div className="w-[78px] shrink-0 text-[13px] text-muted-foreground">
                  {stage.label}
                </div>
                <div className="h-8 flex-1 overflow-hidden rounded-md bg-muted">
                  <div
                    className={`h-full ${stage.fill}`}
                    style={{ width: `${width}%`, minWidth: "6px" }}
                  />
                </div>
                <div className="w-[42px] shrink-0 text-right text-[15px] font-semibold text-foreground tabular-nums">
                  {stage.value.toLocaleString()}
                </div>
              </div>
              {conversion ? (
                <div className="ml-[90px] mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
                  {conversion}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
