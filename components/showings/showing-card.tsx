import Link from "next/link"
import { format, parseISO } from "date-fns"
import { MoreVertical } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Can } from "@/components/auth/Can"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Buyer, ShowingWithRelations } from "@/lib/supabase"
import ShowingStatusBadge from "@/components/showings/showing-status-badge"

interface ShowingCardProps {
  showing: ShowingWithRelations
  onEdit: (showing: ShowingWithRelations) => void
  onDelete: (showing: ShowingWithRelations) => void
  onBuyerClick: (buyer: Buyer) => void
}

const STATUS_STRIPE: Record<string, string> = {
  scheduled: "bg-blue-500",
  completed: "bg-green-500",
  canceled: "bg-red-500",
  rescheduled: "bg-amber-500",
}

export default function ShowingCard({ showing, onEdit, onDelete, onBuyerClick }: ShowingCardProps) {
  const buyerName = showing.buyers
    ? showing.buyers.full_name || `${showing.buyers.fname || ""} ${showing.buyers.lname || ""}`.trim()
    : ""
  const initials = showing.buyers
    ? `${showing.buyers.fname?.[0] || ""}${showing.buyers.lname?.[0] || ""}`.toUpperCase() || "?"
    : ""
  const scheduledAtLabel = showing.scheduled_at
    ? format(parseISO(showing.scheduled_at), "EEE, MMM d · h:mm a")
    : "Schedule pending"

  return (
    <Card className="relative overflow-hidden p-3">
      <div className={`absolute left-0 top-0 h-full w-1 ${STATUS_STRIPE[showing.status || ""] || "bg-blue-500"}`} />
      <div className="ml-2 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-foreground">
            {scheduledAtLabel}
          </p>
          <div>
            {showing.buyers ? (
              <button
                type="button"
                onClick={() => onBuyerClick(showing.buyers as Buyer)}
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials}
                </span>
                <span>{buyerName || "Unnamed Buyer"}</span>
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">No buyer</p>
            )}
          </div>
          <div>
            {showing.properties ? (
              <Link href={`/properties/edit/${showing.properties.id}`} className="text-sm text-blue-600 hover:underline">
                {showing.properties.address}
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">No property</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ShowingStatusBadge status={showing.status} />
          <Can permission="showings.manage">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <span className="sr-only">Actions</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(showing)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(showing)}>Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Can>
        </div>
      </div>
    </Card>
  )
}
