"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { OfferWithRelations } from "@/lib/supabase"

interface OfferCardProps {
  offer: OfferWithRelations
  onClick: (offer: OfferWithRelations) => void
  className?: string
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

function getRelativeTime(dateString?: string) {
  if (!dateString) return ""
  const daysAgo = Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000)
  if (daysAgo <= 0) return "today"
  if (daysAgo === 1) return "1d ago"
  if (daysAgo < 7) return `${daysAgo}d ago`
  return `${Math.floor(daysAgo / 7)}w ago`
}

export default function OfferCard({ offer, onClick, className }: OfferCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: offer.id,
    data: { offer },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  const buyerName = offer.buyers?.full_name || `${offer.buyers?.fname || ""} ${offer.buyers?.lname || ""}`.trim() || "Unnamed"
  const initials = `${offer.buyers?.fname?.[0] || ""}${offer.buyers?.lname?.[0] || ""}`.toUpperCase() || "?"
  const offerType = (offer.offer_type || "financing").toLowerCase()

  return (
    <div onClick={() => onClick(offer)}>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={cn(
          "rounded-lg border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow",
          isDragging && "opacity-50",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </div>
          <p className="text-sm font-medium truncate">{buyerName}</p>
        </div>

        <p className="mt-2 text-sm text-muted-foreground truncate">{offer.properties?.address || "No property"}</p>

        <p className="mt-2 text-lg font-bold">{currencyFormatter.format(offer.offer_price || 0)}</p>

        <div className="mt-2 flex items-center justify-between gap-2">
          <Badge className={offerType === "cash" ? "bg-green-500 hover:bg-green-500/90" : "bg-blue-500 hover:bg-blue-500/90"}>
            {offerType === "cash" ? "Cash" : "Financing"}
          </Badge>
          <span className="text-xs text-muted-foreground">{getRelativeTime(offer.submitted_at || offer.created_at)}</span>
        </div>

        {offer.earnest_money ? (
          <p className="mt-2 text-xs text-muted-foreground">EMD: {currencyFormatter.format(offer.earnest_money)}</p>
        ) : null}
      </div>
    </div>
  )
}
