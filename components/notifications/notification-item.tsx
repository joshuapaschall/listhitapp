"use client"

import type { ComponentType } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import type { Notification } from "@/lib/supabase"
import { cn } from "@/lib/utils"

interface NotificationItemProps {
  notification: Notification
  onDismiss?: (id: string) => void
  compact?: boolean
}

export function NotificationItem({ notification, onDismiss, compact = false }: NotificationItemProps) {
  const router = useRouter()

  const iconMap: Record<string, { icon: ComponentType<{ className?: string }>; className: string }> = {
    showing_scheduled: { icon: Calendar, className: "text-blue-500" },
    showing_reminder: { icon: Clock, className: "text-amber-500" },
    showing_completed: { icon: CheckCircle2, className: "text-green-500" },
    showing_cancelled: { icon: XCircle, className: "text-red-500" },
    showing_rescheduled: { icon: RefreshCw, className: "text-amber-500" },
    showing_deleted: { icon: Trash2, className: "text-red-500" },
  }

  const selectedIcon = iconMap[notification.type] ?? { icon: Bell, className: "text-muted-foreground" }
  const Icon = selectedIcon.icon

  const handleClick = () => {
    if (notification.metadata?.showing_id) {
      router.push("/showings")
      return
    }
    if (notification.metadata?.buyer_id) {
      router.push("/")
      return
    }
    if (notification.type.startsWith("showing_")) {
      router.push("/showings")
      return
    }
    router.push("/")
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-md border px-2 py-2 hover:bg-muted/50",
        compact ? "text-xs" : "text-sm",
      )}
    >
      <button type="button" onClick={handleClick} className="flex flex-1 items-start gap-2 text-left">
        {!notification.read_at && <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />}
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", selectedIcon.className)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{notification.title}</p>
          {notification.body && <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>}
          {notification.created_at && (
            <p className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </p>
          )}
        </div>
      </button>
      {!compact && onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onDismiss(notification.id)}
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
