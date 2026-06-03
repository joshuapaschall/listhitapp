"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import type { OfferWithRelations } from "@/lib/supabase"

interface OfferCardProps {
  offer: OfferWithRelations
  onClick: (offer: OfferWithRelations) => void
  className?: string
  draggable?: boolean
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

// Top-accent color per status — mirrors the kanban column dots.
const STATUS_ACCENT: Record<string, string> = {
  submitted: "border-t-blue-500",
  countered: "border-t-amber-500",
  accepted: "border-t-green-500",
  closed: "border-t-purple-500",
  rejected: "border-t-red-500",
  withdrawn: "border-t-gray-500",
}

function getRelativeTime(dateString?: string) {
  if (!dateString) return ""
  const daysAgo = Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000)
  if (daysAgo <= 0) return "today"
  if (daysAgo === 1) return "1d ago"
  if (daysAgo < 7) return `${daysAgo}d ago`
  return `${Math.floor(daysAgo / 7)}w ago`
}

export default function OfferCard({ offer, onClick, className, draggable = true }: OfferCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: offer.id,
    data: { offer },
    disabled: !draggable,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  const buyerName = offer.buyers?.full_name || `${offer.buyers?.fname || ""} ${offer.buyers?.lname || ""}`.trim() || "Unnamed"
  const initials = `${offer.buyers?.fname?.[0] || ""}${offer.buyers?.lname?.[0] || ""}`.toUpperCase() || "?"
  const offerType = (offer.offer_type || "financing").toLowerCase()
  const accent = STATUS_ACCENT[offer.status || "submitted"] || "border-t-border"

  // Spread = (accepted_price ?? offer_price) − buy_price; only shown when buy_price is known.
  const buyPrice = offer.properties?.buy_price
  const spread = buyPrice == null ? null : (offer.accepted_price ?? offer.offer_price ?? 0) - buyPrice

  return (
    <div onClick={() => onClick(offer)}>
      <div
        ref={setNodeRef}
        style={style}
        {...(draggable ? listeners : {})}
        {...(draggable ? attributes : {})}
        className={cn(
          "rounded-lg border border-border border-t-2 bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
          accent,
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          isDragging && "opacity-50",
          className,
        )}
      >
        {/* Row 1 — buyer */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
            {initials}
          </div>
          <p className="truncate text-sm font-medium text-foreground">{buyerName}</p>
        </div>

        {/* Row 2 — property */}
        <div className="mt-2 flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <p className="truncate text-xs">{offer.properties?.address || "No property"}</p>
        </div>

        {/* Row 3 — offer price */}
        <p className="mt-2 text-base font-medium text-foreground">{currencyFormatter.format(offer.offer_price || 0)}</p>

        {/* Row 4 — spread chip + type pill */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {spread != null ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                spread >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400",
              )}
            >
              {spread >= 0 ? "+" : "−"}
              {currencyFormatter.format(Math.abs(spread))}
            </span>
          ) : null}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {offerType === "cash" ? "Cash" : "Financing"}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">{getRelativeTime(offer.submitted_at || offer.created_at)}</span>
        </div>

        {/* Optional meta */}
        {(offer.earnest_money || offer.proposed_closing_date) ? (
          <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {offer.earnest_money ? <span>EMD {currencyFormatter.format(offer.earnest_money)}</span> : null}
            {offer.proposed_closing_date ? (
              <span>
                Close {new Date(offer.proposed_closing_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
