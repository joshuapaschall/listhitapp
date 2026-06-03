import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { Card } from "@/components/ui/card"

interface ChannelCardProps {
  title: string
  icon: LucideIcon
  href: string
  rows: { label: string; value: string | number }[]
}

function formatValue(value: string | number) {
  return typeof value === "number" ? value.toLocaleString() : value
}

export default function ChannelCard({ title, icon: Icon, href, rows }: ChannelCardProps) {
  return (
    <Link href={href} className="block transition-shadow hover:shadow-md">
      <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/40">
            <Icon className="h-[15px] w-[15px] text-brand" />
          </div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
        </div>
        <div>
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-3 py-1 text-[12.5px]">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium text-foreground tabular-nums">{formatValue(row.value)}</span>
            </div>
          ))}
        </div>
      </Card>
    </Link>
  )
}
