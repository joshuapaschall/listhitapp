"use client"

import { Card } from "@/components/ui/card"
import type { RecentActivityItem } from "@/services/dashboard-service"

interface RecentActivityProps {
  items: RecentActivityItem[]
}

function relativeTime(timestamp: string) {
  const then = new Date(timestamp).getTime()
  if (Number.isNaN(then)) return ""
  const diffMs = Date.now() - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days <= 7) return `${days}d ago`
  return new Date(timestamp).toLocaleString()
}

export default function RecentActivity({ items }: RecentActivityProps) {
  return (
    <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground mb-3">Recent activity</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent activity yet</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center gap-3 border-b border-border last:border-0 py-2"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${index === 0 ? "bg-brand" : "bg-border"}`}
              />
              <span className="flex-1 truncate text-sm text-foreground">{item.description}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(item.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
