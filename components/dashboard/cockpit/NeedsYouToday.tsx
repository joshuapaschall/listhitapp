import Link from "next/link"
import { Calendar, ChevronRight, Clock, FileText, MessageSquare, type LucideIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import type { NeedsYouToday as NeedsYouTodayData } from "@/services/dashboard-service"

interface TodayProps {
  data: NeedsYouTodayData
}

interface NeedRow {
  label: string
  value: number
  href: string
  icon: LucideIcon
  tileClassName: string
  isTaskRow?: boolean
}

export default function NeedsYouToday({ data }: TodayProps) {
  const rows: NeedRow[] = [
    {
      label: "Unread replies",
      value: data.unreadReplies,
      href: "/inbox",
      icon: MessageSquare,
      tileClassName: "bg-brand-tint text-brand",
    },
    {
      label: "Offers awaiting",
      value: data.offersAwaiting,
      href: "/offers",
      icon: FileText,
      tileClassName: "bg-[hsl(var(--chart-3))]/12 text-[hsl(var(--chart-3))]",
    },
    {
      label: "Showings today",
      value: data.showingsToday,
      href: "/showings",
      icon: Calendar,
      tileClassName: "bg-[hsl(var(--chart-2))]/12 text-[hsl(var(--chart-2))]",
    },
    {
      label: "Follow-ups due",
      value: data.followUpsDue,
      href: "#",
      icon: Clock,
      tileClassName: "bg-muted text-muted-foreground",
      isTaskRow: true,
    },
  ]

  return (
    <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-foreground">Needs you today</div>
      <div>
        {rows.map((row) => {
          const Icon = row.icon

          return (
            <Link
              key={row.label}
              href={row.href}
              className="-mx-2 flex items-center gap-3 rounded-md border-b border-border px-2 py-2.5 transition-colors last:border-0 hover:bg-muted/40"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${row.tileClassName}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 text-sm font-medium text-foreground">
                {row.label}
                {row.isTaskRow ? (
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                    (needs tasks)
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={
                    row.isTaskRow && row.value === 0
                      ? "text-sm font-semibold text-muted-foreground/50 tabular-nums"
                      : "text-sm font-semibold text-foreground tabular-nums"
                  }
                >
                  {row.isTaskRow && row.value === 0 ? "—" : row.value.toLocaleString()}
                </span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted-foreground/40" />
              </div>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}
