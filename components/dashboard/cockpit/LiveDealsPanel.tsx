import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LiveDeal } from "@/services/dashboard-service"

interface PanelProps {
  deals: LiveDeal[]
}

function formatStatus(status: string | null) {
  if (status === "available") {
    return "Available"
  }

  if (status === "under_contract") {
    return "Under contract"
  }

  return status ? status.replace(/_/g, " ") : "Status unknown"
}

function statusClassName(status: string | null) {
  if (status === "available") {
    return "border-transparent bg-muted/40 text-brand hover:bg-muted/40"
  }

  if (status === "under_contract") {
    return "border-transparent bg-[hsl(var(--chart-3))]/12 text-[hsl(var(--chart-3))] hover:bg-[hsl(var(--chart-3))]/12"
  }

  return "border-transparent bg-muted text-muted-foreground hover:bg-muted"
}

export default function LiveDealsPanel({ deals }: PanelProps) {
  const visibleDeals = deals.slice(0, 6)

  return (
    <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-foreground">Live deals</div>
        <Link href="/properties" className="text-xs font-medium text-brand">
          View all ›
        </Link>
      </div>
      {visibleDeals.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No active listings yet</div>
      ) : (
        <div>
          {visibleDeals.map((deal) => {
            const isStale = deal.daysOnMarket >= 14 && deal.offerCount === 0

            return (
              <div
                key={deal.id}
                className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {deal.address ?? "Untitled property"}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-[11px]",
                      isStale ? "text-[hsl(var(--chart-3))]" : "text-muted-foreground"
                    )}
                  >
                    {deal.daysOnMarket.toLocaleString()} days on market
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Badge className={statusClassName(deal.status)}>{formatStatus(deal.status)}</Badge>
                  <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    {deal.offerCount.toLocaleString()} {deal.offerCount === 1 ? "offer" : "offers"}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
