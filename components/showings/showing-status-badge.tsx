import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  },
  canceled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
  rescheduled: {
    label: "Rescheduled",
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
}

export default function ShowingStatusBadge({ status }: { status?: string }) {
  const style = STATUS_STYLES[status || ""] || STATUS_STYLES.scheduled
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", style.className)}>
      {style.label}
    </Badge>
  )
}
