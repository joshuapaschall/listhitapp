"use client"

import { useId } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card } from "@/components/ui/card"
import type {
  CallTrend,
  EmailTrend,
  TextTrend,
  TrendWithDelta,
} from "@/services/dashboard-service"

interface ActivityTrendProps {
  textTrends: TrendWithDelta<TextTrend>
  callTrends: TrendWithDelta<CallTrend>
  emailTrends: TrendWithDelta<EmailTrend>
}

interface ActivityPoint {
  label: string
  texts: number
  emails: number
  calls: number
}

const SERIES = [
  { label: "Texts", key: "texts", color: "hsl(var(--chart-1))" },
  { label: "Emails", key: "emails", color: "hsl(var(--chart-2))" },
  { label: "Calls", key: "calls", color: "hsl(var(--chart-3))" },
] as const

function formatDateLabel(date: string | undefined) {
  if (!date) {
    return "—"
  }

  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
  }).format(parsed)
}

function buildActivityData({ textTrends, callTrends, emailTrends }: ActivityTrendProps): ActivityPoint[] {
  const maxLength = Math.max(
    textTrends.data.length,
    callTrends.data.length,
    emailTrends.data.length,
  )

  return Array.from({ length: maxLength }, (_, index) => {
    const textPoint = textTrends.data[index]
    const callPoint = callTrends.data[index]
    const emailPoint = emailTrends.data[index]

    return {
      label: formatDateLabel(textPoint?.date ?? emailPoint?.date ?? callPoint?.date),
      texts: textPoint?.sent ?? 0,
      emails: emailPoint?.sent ?? 0,
      calls: callPoint?.made ?? 0,
    }
  })
}

export default function ActivityTrend(props: ActivityTrendProps) {
  const reactId = useId().replace(/:/g, "")
  const data = buildActivityData(props)
  const hasActivity = data.some((point) => point.texts > 0 || point.emails > 0 || point.calls > 0)

  return (
    <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-foreground">Activity over time</div>
        <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
          {SERIES.map((series) => (
            <div key={series.key} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: series.color }}
              />
              <span>{series.label}</span>
            </div>
          ))}
        </div>
      </div>
      {!hasActivity ? (
        <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          No activity in this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              {SERIES.map((series) => (
                <linearGradient
                  key={series.key}
                  id={`activity-${series.key}-${reactId}`}
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={series.color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={series.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.45} vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip />
            {SERIES.map((series) => (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                stroke={series.color}
                strokeWidth={2}
                fill={`url(#activity-${series.key}-${reactId})`}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
