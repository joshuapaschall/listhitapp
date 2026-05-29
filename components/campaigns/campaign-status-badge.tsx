import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// Status values the backend may set on the `campaigns` table. Keep in sync with:
// - app/api/campaigns/send/route.ts (sets "pending", "processing")
// - services/campaign-sender.ts (sets "processing", "pending", "sent", "error")
// - services/sms-campaign-sender.ts (sets "processing")
// - draft state from user creation
// - scheduled state for future-dated sends
// - completed_with_errors for partial-success sends
type KnownStatus =
  | "draft"
  | "scheduled"
  | "pending"
  | "processing"
  | "sending"
  | "sent"
  | "error"
  | "completed_with_errors"

type CampaignStatusBadgeProps = {
  status: KnownStatus | string | null | undefined
}

const statusConfig: Record<KnownStatus, { label: string; className: string; icon?: JSX.Element }> = {
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    icon: <Clock className="size-3" />,
  },
  pending: {
    label: "Queued",
    className: "bg-brand-tint text-brand dark:bg-brand/20 dark:text-brand",
    icon: <Clock className="size-3" />,
  },
  processing: {
    label: "Sending",
    className: "bg-brand-tint text-brand dark:bg-brand/20 dark:text-brand",
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  sending: {
    label: "Sending",
    className: "bg-brand-tint text-brand dark:bg-brand/20 dark:text-brand",
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  sent: {
    label: "Sent",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    icon: <CheckCircle2 className="size-3" />,
  },
  error: {
    label: "Failed",
    className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    icon: <AlertCircle className="size-3" />,
  },
  completed_with_errors: {
    label: "Sent with errors",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    icon: <AlertTriangle className="size-3" />,
  },
}

const fallbackConfig: { label: string; className: string; icon?: JSX.Element } = {
  label: "Unknown",
  className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
}

export default function CampaignStatusBadge({ status }: CampaignStatusBadgeProps) {
  const config = (status && statusConfig[status as KnownStatus]) || fallbackConfig

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      {"icon" in config ? config.icon : null}
      {config.label}
    </span>
  )
}
