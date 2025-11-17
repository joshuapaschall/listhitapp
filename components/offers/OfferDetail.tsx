"use client"

import { useState, useEffect } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Offer } from "@/lib/supabase"
import { OfferService } from "@/services/offer-service"
import { toast } from "sonner"

const STATUS_OPTIONS = [
  "submitted",
  "accepted",
  "rejected",
  "withdrawn",
  "countered",
  "closed",
]

interface OfferDetailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  offer: Offer | null
  onSuccess?: () => void
}

export default function OfferDetail({ open, onOpenChange, offer, onSuccess }: OfferDetailProps) {
  const [status, setStatus] = useState("submitted")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && offer) {
      setStatus(offer.status)
      setNotes(offer.notes ?? "")
    }
  }, [open, offer])

  const handleClose = () => {
    if (!loading) onOpenChange(false)
  }

  const handleSave = async () => {
    if (!offer) return
    setLoading(true)
    try {
      await OfferService.updateOffer(offer.id, { status, notes })
      toast.success("Offer updated")
      if (onSuccess) onSuccess()
      handleClose()
    } catch (err) {
      console.error("Error updating offer:", err)
      toast.error("Failed to update offer")
    } finally {
      setLoading(false)
    }
  }

  if (!offer) return null

  const displayName = (b: any) =>
    b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Offer Details</DialogTitle>
          <DialogDescription>
            {displayName(offer.buyers)} on {offer.properties?.address}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="block mb-1 text-sm font-medium">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

