"use client"

import Link from "next/link"
import { format, parseISO } from "date-fns"
import { MapPin, MessageSquare, MoreVertical } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Can } from "@/components/auth/Can"
import { CallButton } from "@/components/voice/CallButton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Buyer, ShowingWithRelations } from "@/lib/supabase"
import ShowingStatusBadge from "@/components/showings/showing-status-badge"

interface ShowingCardProps {
  showing: ShowingWithRelations
  onEdit: (showing: ShowingWithRelations) => void
  onDelete: (showing: ShowingWithRelations) => void
  onBuyerClick: (buyer: Buyer) => void
  onText: (buyer: Buyer) => void
  onCancel: (showing: ShowingWithRelations) => void
}

const STATUS_STRIPE: Record<string, string> = {
  scheduled: "bg-blue-500",
  completed: "bg-green-500",
  canceled: "bg-red-500",
  rescheduled: "bg-amber-500",
}

export default function ShowingCard({ showing, onEdit, onDelete, onBuyerClick, onText, onCancel }: ShowingCardProps) {
  const buyer = (showing.buyers as Buyer | null | undefined) || null
  const buyerName = buyer ? buyer.full_name || `${buyer.fname || ""} ${buyer.lname || ""}`.trim() : ""
  const initials = buyer ? `${buyer.fname?.[0] || ""}${buyer.lname?.[0] || ""}`.toUpperCase() || "?" : ""
  const dt = showing.scheduled_at ? parseISO(showing.scheduled_at) : null
  const status = showing.status || "scheduled"
  const canCancel = status !== "canceled" && status !== "completed"

  return (
    <Card className="relative overflow-hidden border-border p-3 pl-4">
      <div className={`absolute left-0 top-0 h-full w-1 ${STATUS_STRIPE[status] || "bg-blue-500"}`} />
      <div className="flex items-start gap-3">
        {/* Time block */}
        <div className="w-14 shrink-0 text-center">
          {dt ? (
            <>
              <div className="text-base font-semibold leading-tight text-foreground">{format(dt, "h:mm")}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{format(dt, "a")}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{format(dt, "MMM d")}</div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground">TBD</div>
          )}
        </div>

        {/* Main */}
        <div className="min-w-0 flex-1 space-y-1">
          {buyer ? (
            <button
              type="button"
              onClick={() => onBuyerClick(buyer)}
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-brand"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">{initials}</span>
              <span className="truncate">{buyerName || "Unnamed buyer"}</span>
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">No buyer</p>
          )}
          {showing.properties ? (
            <Link href={`/properties/edit/${showing.properties.id}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{showing.properties.address}</span>
            </Link>
          ) : (
            <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />No property</p>
          )}
          <ShowingStatusBadge status={showing.status} />
        </div>

        {/* Quick actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          {buyer ? <CallButton phone={buyer.phone} name={buyerName} buyerId={buyer.id} /> : null}
          {buyer ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-brand hover:text-brand"
              aria-label="Text buyer"
              onClick={() => onText(buyer)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          ) : null}
          <Can permission="showings.manage">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <span className="sr-only">Actions</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(showing)}>Reschedule</DropdownMenuItem>
                {buyer ? <DropdownMenuItem onClick={() => onBuyerClick(buyer)}>View buyer</DropdownMenuItem> : null}
                {canCancel ? <DropdownMenuItem onClick={() => onCancel(showing)}>Cancel</DropdownMenuItem> : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(showing)} className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Can>
        </div>
      </div>
    </Card>
  )
}
