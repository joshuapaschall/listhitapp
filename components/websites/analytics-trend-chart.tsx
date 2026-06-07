"use client"

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

// recharts can't read CSS variables, so the dashboard brand red is hardcoded.
const VISITS = "#F0303A"
const SIGNUPS = "#6b7280"

export interface TrendPoint {
  label: string
  visits: number
  signups: number
}

export function AnalyticsTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: VISITS }} />
          Visits
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-3.5 border-t-2 border-dashed" style={{ borderColor: SIGNUPS }} />
          Signups
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            minTickGap={20}
          />
          <YAxis
            yAxisId="visits"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={36}
          />
          <YAxis
            yAxisId="signups"
            orientation="right"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--popover))",
              fontSize: 12,
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
          />
          <Line
            yAxisId="visits"
            type="monotone"
            dataKey="visits"
            name="Visits"
            stroke={VISITS}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="signups"
            type="monotone"
            dataKey="signups"
            name="Signups"
            stroke={SIGNUPS}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
