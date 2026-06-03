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
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { OfferWithRelations } from "@/lib/supabase"
import OfferCard from "./offer-card"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { DollarSign } from "lucide-react"

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

const moneyToNumber = (value: string) => {
  if (!value.trim()) return null
  const numeric = Number(value.replace(/[^\d.-]/g, ""))
  return Number.isFinite(numeric) ? numeric : null
}

const formatMoneyInput = (value: number | null | undefined) =>
  value == null ? "" : String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

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
  const [pendingAcceptedOffer, setPendingAcceptedOffer] = useState<OfferWithRelations | null>(null)
  const [acceptedPrice, setAcceptedPrice] = useState("")
  const [assignmentFee, setAssignmentFee] = useState("")
  const [dealExpenses, setDealExpenses] = useState("0")
  const [isAccepting, setIsAccepting] = useState(false)

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

    if (newStatus === "accepted") {
      const defaultAcceptedPrice = offer.accepted_price ?? offer.offer_price ?? null
      const defaultAssignmentFee =
        defaultAcceptedPrice != null && offer.properties?.buy_price != null
          ? defaultAcceptedPrice - offer.properties.buy_price
          : offer.assignment_fee ?? null

      setPendingAcceptedOffer(offer)
      setAcceptedPrice(formatMoneyInput(defaultAcceptedPrice))
      setAssignmentFee(formatMoneyInput(defaultAssignmentFee))
      setDealExpenses(formatMoneyInput(offer.deal_expenses ?? 0))
      return
    }

    try {
      await OfferService.updateOfferStatus(offer.id, newStatus)
      toast.success(`Offer moved to ${newStatus}`)
      onRefetch()
    } catch {
      toast.error("Failed to update offer status")
      onRefetch()
    }
  }, [canManage, onRefetch])

  const confirmAcceptedEconomics = useCallback(async () => {
    if (!pendingAcceptedOffer) return

    try {
      setIsAccepting(true)
      await OfferService.updateOffer(pendingAcceptedOffer.id, {
        status: "accepted",
        accepted_price: moneyToNumber(acceptedPrice),
        assignment_fee: moneyToNumber(assignmentFee),
        deal_expenses: moneyToNumber(dealExpenses) ?? 0,
      })
      toast.success("Offer moved to accepted")
      setPendingAcceptedOffer(null)
      onRefetch()
    } catch {
      toast.error("Failed to accept offer")
      onRefetch()
    } finally {
      setIsAccepting(false)
    }
  }, [acceptedPrice, assignmentFee, dealExpenses, onRefetch, pendingAcceptedOffer])

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading offers...</p>
  }

  return (
    <>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 min-w-0">
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
    <Dialog open={!!pendingAcceptedOffer} onOpenChange={(open) => !open && setPendingAcceptedOffer(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accept offer economics</DialogTitle>
          <DialogDescription>Capture the deal economics used to power disposition profit metrics.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2"><Label>Accepted price</Label><div className="relative"><DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={acceptedPrice} onChange={(e) => setAcceptedPrice(e.target.value)} /></div></div>
          <div className="space-y-2"><Label>Assignment fee</Label><div className="relative"><DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={assignmentFee} onChange={(e) => setAssignmentFee(e.target.value)} /></div></div>
          <div className="space-y-2"><Label>Deal expenses</Label><div className="relative"><DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={dealExpenses} onChange={(e) => setDealExpenses(e.target.value)} /></div></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPendingAcceptedOffer(null)} disabled={isAccepting}>Cancel</Button>
          <Button onClick={confirmAcceptedEconomics} disabled={isAccepting}>Accept offer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
