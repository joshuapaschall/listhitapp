"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { DashboardKpis } from "@/services/dashboard-service"

interface AllMetricsDrawerProps {
  kpis: DashboardKpis
}

interface MetricStat {
  label: string
  value: string
}

interface MetricGroup {
  title: string
  stats: MetricStat[]
}

function formatCount(value: number) {
  return value.toLocaleString()
}

function formatPercent(value: number) {
  return `${value}%`
}

export default function AllMetricsDrawer({ kpis }: AllMetricsDrawerProps) {
  const [open, setOpen] = useState(false)
  const groups: MetricGroup[] = [
    {
      title: "Email",
      stats: [
        { label: "Sent", value: formatCount(kpis.emailsSent) },
        { label: "Open rate", value: formatPercent(kpis.openRate) },
        { label: "Click rate", value: formatPercent(kpis.clickRate) },
        { label: "Bounce rate", value: formatPercent(kpis.bounceRate) },
      ],
    },
    {
      title: "SMS",
      stats: [
        { label: "Sent", value: formatCount(kpis.textsSent) },
        { label: "Received", value: formatCount(kpis.textsReceived) },
        { label: "Opt-outs", value: formatCount(kpis.smsUnsubscribes) },
        { label: "Unsub rate", value: formatPercent(kpis.unsubscribeRate) },
      ],
    },
    {
      title: "Calls",
      stats: [
        { label: "Made", value: formatCount(kpis.callsMade) },
        { label: "Received", value: formatCount(kpis.callsReceived) },
        { label: "Voicemails", value: formatCount(kpis.voicemailsLeft) },
      ],
    },
    {
      title: "Offers & Showings",
      stats: [
        { label: "Offers created", value: formatCount(kpis.offersCreated) },
        { label: "Declined", value: formatCount(kpis.offersDeclined) },
        { label: "Countered", value: formatCount(kpis.offersCountered) },
        { label: "Completed showings", value: formatCount(kpis.showingsCompleted) },
        { label: "Cancelled", value: formatCount(kpis.showingsCancelled) },
      ],
    },
  ]

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button type="button" className="w-full text-left">
          <Card className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40">
            <div>
              <div className="text-sm font-semibold text-foreground">All metrics</div>
              <div className="text-xs text-muted-foreground">
                Detailed email, SMS, call, offer &amp; showing stats
              </div>
            </div>
            <ChevronDown
              aria-hidden="true"
              data-state={open ? "open" : "closed"}
              className="h-[18px] w-[18px] text-muted-foreground transition-transform data-[state=open]:rotate-180"
            />
          </Card>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-x-10 gap-y-6 md:grid-cols-2 lg:grid-cols-2">
            {groups.map((group) => (
              <div key={group.title}>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.title}
                </div>
                <div>
                  {group.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="flex justify-between gap-3 border-b border-border py-1 text-[13px] last:border-0"
                    >
                      <span className="text-muted-foreground">{stat.label}</span>
                      <span className="font-medium text-foreground tabular-nums">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  )
}
