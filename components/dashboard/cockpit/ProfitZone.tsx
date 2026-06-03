import Link from "next/link"
import { Plug } from "lucide-react"

import { Card } from "@/components/ui/card"
import type { DashboardProfit } from "@/services/dashboard-service"

interface ProfitZoneProps {
  data: DashboardProfit
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

function formatUsd(value: number) {
  return usdFormatter.format(value)
}

export default function ProfitZone({ data }: ProfitZoneProps) {
  const emptyTiles = ["Gross profit", "Net profit", "Avg assignment fee", "Marketing ROI"]
  const populatedTiles = [
    { label: "Gross profit", value: formatUsd(data.grossProfit), className: "bg-muted/40" },
    { label: "Net profit", value: formatUsd(data.netProfit), className: "bg-muted/40" },
    { label: "Avg assignment fee", value: formatUsd(data.avgAssignmentFee), className: "bg-muted/40" },
    {
      label: "Marketing ROI",
      value: data.marketingRoi !== null ? `${Math.round(data.marketingRoi)}×` : "—",
      className: "bg-muted",
    },
  ]

  return (
    <Card className="rounded-2xl border border-border border-l-[3px] border-l-brand bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-foreground">Profit &amp; performance</div>
        {data.hasData ? (
          <div className="flex items-center gap-1.5 text-right text-[11px] text-muted-foreground">
            <Plug className="h-3.5 w-3.5" />
            <span>
              {data.closedCount.toLocaleString()} closed · {formatUsd(data.marketingSpend)} marketing spend
            </span>
          </div>
        ) : (
          <Link
            href="/properties"
            className="flex items-center gap-1.5 text-right text-[11px] text-muted-foreground hover:text-brand"
          >
            <Plug className="h-3.5 w-3.5" />
            <span>Connect deal data to populate</span>
          </Link>
        )}
      </div>
      {data.hasData ? (
        <div className="mb-4">
          <div className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
            {formatUsd(data.netProfit)}
          </div>
          <div className="text-[11px] text-muted-foreground">net profit this period</div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {data.hasData
          ? populatedTiles.map((tile) => (
              <div key={tile.label} className={`rounded-xl p-3.5 ${tile.className}`}>
                <div className="text-xs text-brand">{tile.label}</div>
                <div className="mt-1.5 text-2xl font-semibold text-foreground tabular-nums">
                  {tile.value}
                </div>
              </div>
            ))
          : emptyTiles.map((label) => (
              <div key={label} className="rounded-xl border border-dashed border-border p-3.5">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="mt-1.5 text-2xl font-semibold text-muted-foreground/40 tabular-nums">
                  —
                </div>
              </div>
            ))}
      </div>
    </Card>
  )
}
