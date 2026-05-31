"use client"

import { useCallback, useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { OfferService } from "@/services/offer-service"
import type { OfferWithRelations } from "@/lib/supabase"
import OfferCard from "./offer-card"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface OffersKanbanViewProps {
  offers: OfferWithRelations[]
  isLoading: boolean
  onRefetch: () => void
  onOfferClick: (offer: OfferWithRelations) => void
  canManage?: boolean
}

const KANBAN_COLUMNS = [
  { id: "submitted", label: "Submitted", color: "bg-blue-500" },
  { id: "countered", label: "Countered", color: "bg-amber-500" },
  { id: "accepted", label: "Accepted", color: "bg-green-500" },
  { id: "closed", label: "Closed", color: "bg-purple-500" },
  { id: "rejected", label: "Rejected", color: "bg-red-500" },
  { id: "withdrawn", label: "Withdrawn", color: "bg-gray-500" },
] as const

function KanbanColumn({ id, label, color, offers, onOfferClick, canManage }: {
  id: string
  label: string
  color: string
  offers: OfferWithRelations[]
  onOfferClick: (offer: OfferWithRelations) => void
  canManage: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !canManage })

  return (
    <div className="flex flex-col min-w-[280px] w-[280px]">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
        <span className="text-sm font-semibold">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground">{offers.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 overflow-y-auto rounded-lg bg-muted/30 p-2 min-h-[360px]",
          isOver && "ring-2 ring-primary/30",
        )}
      >
        {offers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No offers</p>
        ) : (
          offers.map((offer) => <OfferCard key={offer.id} offer={offer} onClick={onOfferClick} draggable={canManage} />)
        )}
      </div>
    </div>
  )
}

export default function OffersKanbanView({ offers, isLoading, onRefetch, onOfferClick, canManage = false }: OffersKanbanViewProps) {
  const [activeOffer, setActiveOffer] = useState<OfferWithRelations | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const grouped = useMemo(
    () => KANBAN_COLUMNS.map((col) => ({ ...col, offers: offers.filter((offer) => offer.status === col.id) })),
    [offers],
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const offer = event.active.data.current?.offer as OfferWithRelations | undefined
    if (offer) setActiveOffer(offer)
  }, [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveOffer(null)
    const offer = event.active.data.current?.offer as OfferWithRelations | undefined
    const newStatus = event.over?.id as string | undefined

    if (!canManage) return
    if (!offer || !newStatus || newStatus === offer.status) return

    try {
      await OfferService.updateOfferStatus(offer.id, newStatus)
      toast.success(`Offer moved to ${newStatus}`)
      onRefetch()
    } catch {
      toast.error("Failed to update offer status")
      onRefetch()
    }
  }, [canManage, onRefetch])

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading offers...</p>
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {grouped.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            label={column.label}
            color={column.color}
            offers={column.offers}
              onOfferClick={onOfferClick}
              canManage={canManage}
          />
        ))}
      </div>
      <DragOverlay>
        {activeOffer ? <OfferCard offer={activeOffer} onClick={() => undefined} className="rotate-2 scale-105" draggable={canManage} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
