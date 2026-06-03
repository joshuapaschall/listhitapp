import { useId } from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface KpiStatProps {
  label: string
  value: string | number
  delta?: number
  sublabel?: string
  spark?: number[]
}

function formatValue(value: string | number) {
  return typeof value === "number" ? value.toLocaleString() : value
}

function buildSparkPoints(values: number[]) {
  const width = 100
  const height = 20
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
      const y = range === 0 ? height / 2 : height - ((value - min) / range) * (height - 4) - 2

      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")
}

export default function KpiStat({ label, value, delta, sublabel, spark }: KpiStatProps) {
  const reactId = useId()
  const gradientId = `kpi-spark-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${reactId.replace(/:/g, "")}`
  const sparkPoints = spark?.length ? buildSparkPoints(spark) : null
  const fillPoints = sparkPoints ? `0,20 ${sparkPoints} 100,20` : null

  return (
    <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-end gap-2">
        <div className="text-[27px] font-[650] leading-none tracking-tight text-foreground tabular-nums">
          {formatValue(value)}
        </div>
        {delta !== undefined && (
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums",
              delta >= 0 ? "bg-muted/40 text-foreground" : "bg-destructive/10 text-destructive"
            )}
          >
            {delta >= 0 ? "↑" : "↓"} {Math.abs(Math.round(delta))}%
          </span>
        )}
      </div>
      {sublabel ? (
        <div className="mt-2 text-[11px] text-muted-foreground/70">{sublabel}</div>
      ) : null}
      {sparkPoints && fillPoints ? (
        <svg
          aria-hidden="true"
          className="mt-3 h-5 w-full"
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0.18" />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={fillPoints} fill={`url(#${gradientId})`} />
          <polyline
            points={sparkPoints}
            fill="none"
            stroke="hsl(var(--chart-1))"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
    </Card>
  )
}
