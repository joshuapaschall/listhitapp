"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import type { OfferWithRelations } from "@/lib/supabase"
import { OfferService } from "@/services/offer-service"
import { toast } from "sonner"
import { Clock, DollarSign, Home, Trash2, User } from "lucide-react"

interface OfferDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  offer: OfferWithRelations | null
  onSuccess?: () => void
  canManage?: boolean
}
const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const statuses = ["submitted", "accepted", "rejected", "withdrawn", "countered", "closed"]
const moneyToNumber = (value: string) => {
  if (!value.trim()) return null
  const numeric = Number(value.replace(/[^\d.-]/g, ""))
  return Number.isFinite(numeric) ? numeric : null
}
const formatMoneyInput = (value: number | null | undefined) =>
  value == null ? "" : String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

export default function OfferDetailDrawer({ open, onOpenChange, offer, onSuccess, canManage = false }: OfferDetailDrawerProps) {
  const [status, setStatus] = useState<string>(offer?.status || "submitted")
  const [notes, setNotes] = useState<string>(offer?.notes || "")
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [economicsOpen, setEconomicsOpen] = useState(false)
  const [acceptedPrice, setAcceptedPrice] = useState("")
  const [assignmentFee, setAssignmentFee] = useState("")
  const [dealExpenses, setDealExpenses] = useState("0")

  useEffect(() => {
    setStatus(offer?.status || "submitted")
    setNotes(offer?.notes || "")
  }, [offer])

  const timeline = useMemo(() => {
    if (!offer) return []
    const entries = [
      { status: "Submitted", date: offer.submitted_at, color: "bg-blue-500" },
      { status: "Countered", date: offer.countered_at, color: "bg-amber-500" },
      { status: "Accepted", date: offer.accepted_at, color: "bg-green-500" },
      { status: "Closed", date: offer.closed_at, color: "bg-purple-500" },
      { status: "Rejected", date: offer.rejected_at, color: "bg-red-500" },
      { status: "Withdrawn", date: offer.withdrawn_at, color: "bg-gray-500" },
    ].filter((entry) => !!entry.date) as { status: string; date: string; color: string }[]

    return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [offer])

  if (!offer) return null

  const buyerName = offer.buyers?.full_name || `${offer.buyers?.fname || ""} ${offer.buyers?.lname || ""}`.trim() || "Unnamed"
  const initials = `${offer.buyers?.fname?.[0] || ""}${offer.buyers?.lname?.[0] || ""}`.toUpperCase() || "?"
  const offerType = (offer.offer_type || "financing").toLowerCase()

  const openEconomicsDialog = () => {
    const defaultAcceptedPrice = offer.accepted_price ?? offer.offer_price ?? null
    const defaultAssignmentFee =
      defaultAcceptedPrice != null && offer.properties?.buy_price != null
        ? defaultAcceptedPrice - offer.properties.buy_price
        : offer.assignment_fee ?? null

    setAcceptedPrice(formatMoneyInput(defaultAcceptedPrice))
    setAssignmentFee(formatMoneyInput(defaultAssignmentFee))
    setDealExpenses(formatMoneyInput(offer.deal_expenses ?? 0))
    setEconomicsOpen(true)
  }

  const handleUpdateStatus = async () => {
    if (status === "accepted" && offer.status !== "accepted") {
      openEconomicsDialog()
      return
    }

    try {
      setIsSavingStatus(true)
      await OfferService.updateOffer(offer.id, { status })
      toast.success("Status updated")
      onSuccess?.()
    } catch {
      toast.error("Failed to update status")
    } finally {
      setIsSavingStatus(false)
    }
  }

  const confirmAcceptedEconomics = async () => {
    const accepted_price = moneyToNumber(acceptedPrice)
    const assignment_fee = moneyToNumber(assignmentFee)
    const deal_expenses = moneyToNumber(dealExpenses) ?? 0

    try {
      setIsSavingStatus(true)
      await OfferService.updateOffer(offer.id, {
        status: "accepted",
        accepted_price,
        assignment_fee,
        deal_expenses,
      })
      toast.success("Offer accepted")
      setEconomicsOpen(false)
      onSuccess?.()
    } catch {
      toast.error("Failed to accept offer")
    } finally {
      setIsSavingStatus(false)
    }
  }

  const handleSaveNotes = async () => {
    try {
      setIsSavingNotes(true)
      await OfferService.updateOffer(offer.id, { notes })
      toast.success("Notes saved")
      onSuccess?.()
    } catch {
      toast.error("Failed to save notes")
    } finally {
      setIsSavingNotes(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm("Delete this offer? This cannot be undone.")) return
    try {
      await OfferService.deleteOffer(offer.id)
      toast.success("Offer deleted")
      onOpenChange(false)
      onSuccess?.()
    } catch {
      toast.error("Failed to delete offer")
    }
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials}</div>
            <div>
              <SheetTitle>{buyerName}</SheetTitle>
              <SheetDescription>{offer.properties?.address || "No property address"}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="rounded-lg border p-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground"><DollarSign className="h-4 w-4" /><span className="text-sm">Offer Price</span></div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-3xl font-bold">{currencyFormatter.format(offer.offer_price || 0)}</p>
              <Badge className={offerType === "cash" ? "bg-green-500 hover:bg-green-500/90" : "bg-blue-500 hover:bg-blue-500/90"}>{offerType === "cash" ? "Cash" : "Financing"}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Down Payment</p>
              <p className="font-medium">{currencyFormatter.format(offer.down_payment || 0)}</p>
            </div>
            {offerType !== "cash" && (
              <div>
                <p className="text-sm text-muted-foreground">Monthly Payment</p>
                <p className="font-medium">{currencyFormatter.format(offer.monthly_payment || 0)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Earnest Money</p>
              <p className="font-medium">{currencyFormatter.format(offer.earnest_money || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due Diligence</p>
              <p className="font-medium">{offer.due_diligence_days != null ? `${offer.due_diligence_days} days` : "None"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Proposed Closing</p>
              <p className="font-medium">{offer.proposed_closing_date ? new Date(offer.proposed_closing_date + "T00:00:00").toLocaleDateString("en-US", { dateStyle: "medium" }) : "Not set"}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-medium">Status</p></div>
            <Badge>{offer.status || "submitted"}</Badge>
            {canManage && (
              <>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleUpdateStatus} disabled={isSavingStatus || status === offer.status}>
                  Update Status
                </Button>
              </>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Notes</p>
            {canManage ? (
              <>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="Add notes..." />
                <Button onClick={handleSaveNotes} disabled={isSavingNotes || notes === (offer.notes || "")}>Save Notes</Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{offer.notes || "No notes."}</p>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Status Timeline</p>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No status activity yet.</p>
            ) : (
              <div className="space-y-3">
                {timeline.map((item) => (
                  <div key={`${item.status}-${item.date}`} className="flex items-start gap-3">
                    <div className={`mt-1 h-2.5 w-2.5 rounded-full ${item.color}`} />
                    <div>
                      <p className="text-sm font-medium">{item.status}</p>
                      <p className="text-xs text-muted-foreground">{new Date(item.date).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 pb-4">
            <Separator />
            <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><User className="h-4 w-4" />{buyerName}</div>
              <div className="flex items-center gap-2"><Home className="h-4 w-4" />{offer.properties?.address || "No property"}</div>
            </div>
            {canManage && (
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Offer
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
    <Dialog open={economicsOpen} onOpenChange={setEconomicsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accept offer economics</DialogTitle>
          <DialogDescription>Capture the deal economics used to power disposition profit metrics.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Accepted price</Label>
            <div className="relative"><DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={acceptedPrice} onChange={(e) => setAcceptedPrice(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Assignment fee</Label>
            <div className="relative"><DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={assignmentFee} onChange={(e) => setAssignmentFee(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Deal expenses</Label>
            <div className="relative"><DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={dealExpenses} onChange={(e) => setDealExpenses(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEconomicsOpen(false)} disabled={isSavingStatus}>Cancel</Button>
          <Button onClick={confirmAcceptedEconomics} disabled={isSavingStatus}>Accept offer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
