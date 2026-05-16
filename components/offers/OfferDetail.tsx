"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { OfferWithRelations } from "@/lib/supabase"
import { OfferService } from "@/services/offer-service"
import { toast } from "sonner"

const STATUS_OPTIONS = ["submitted", "accepted", "rejected", "withdrawn", "countered", "closed"]

interface OfferDetailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  offer: OfferWithRelations | null
  onSuccess?: () => void
}

export default function OfferDetail({ open, onOpenChange, offer, onSuccess }: OfferDetailProps) {
  const [status, setStatus] = useState("submitted")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && offer) {
      setStatus(offer.status || "submitted")
      setNotes(offer.notes ?? "")
    }
  }, [open, offer])

  const timeline = useMemo(() => {
    if (!offer) return []
    return [
      { label: "Submitted", at: offer.submitted_at },
      { label: "Accepted", at: offer.accepted_at },
      { label: "Rejected", at: offer.rejected_at },
      { label: "Withdrawn", at: offer.withdrawn_at },
      { label: "Countered", at: offer.countered_at },
      { label: "Closed", at: offer.closed_at },
    ].filter((item) => !!item.at)
  }, [offer])

  const handleClose = () => {
    if (!loading) onOpenChange(false)
  }

  const handleSave = async () => {
    if (!offer) return
    setLoading(true)
    try {
      await OfferService.updateOffer(offer.id, { status, notes })
      toast.success("Offer updated")
      onSuccess?.()
      handleClose()
    } catch (err) {
      console.error("Error updating offer:", err)
      toast.error("Failed to update offer")
    } finally {
      setLoading(false)
    }
  }

  if (!offer) return null

  const displayName = offer.buyers?.full_name || `${offer.buyers?.fname || ""} ${offer.buyers?.lname || ""}`.trim() || "Unnamed"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Offer Details</DialogTitle>
          <DialogDescription>{displayName} on {offer.properties?.address || "Unknown property"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <p><span className="font-medium">Offer Type:</span> {offer.offer_type || "-"}</p>
            <p><span className="font-medium">Offer Price:</span> {offer.offer_price ?? "-"}</p>
            <p><span className="font-medium">Down Payment:</span> {offer.down_payment ?? "-"}</p>
            <p><span className="font-medium">Monthly Payment:</span> {offer.monthly_payment ?? "-"}</p>
            <p><span className="font-medium">Earnest Money:</span> {offer.earnest_money ?? "-"}</p>
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Status Timeline</p>
            <ul className="space-y-1 text-sm">
              {timeline.length === 0 && <li>No status timestamps yet.</li>}
              {timeline.map((item) => (
                <li key={item.label}>{item.label}: {new Date(item.at || "").toLocaleString()}</li>
              ))}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>Close</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
