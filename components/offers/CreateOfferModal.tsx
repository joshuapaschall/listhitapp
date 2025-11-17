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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import BuyerSelector from "@/components/buyers/buyer-selector"
import PropertySelector from "@/components/buyers/property-selector"
import type { Buyer, Property } from "@/lib/supabase"
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

interface CreateOfferModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  buyer?: Buyer | null
  property?: Property | null
}

export default function CreateOfferModal({
  open,
  onOpenChange,
  onSuccess,
  buyer: defaultBuyer = null,
  property: defaultProperty = null,
}: CreateOfferModalProps) {
  const [buyer, setBuyer] = useState<Buyer | null>(defaultBuyer)
  const [property, setProperty] = useState<Property | null>(defaultProperty)
  const [offerType, setOfferType] = useState("")
  const [offerPrice, setOfferPrice] = useState("")
  const [status, setStatus] = useState("submitted")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setBuyer(defaultBuyer)
      setProperty(defaultProperty)
    }
  }, [open, defaultBuyer, defaultProperty])

  const handleClose = () => {
    if (!loading) {
      setOfferType("")
      setOfferPrice("")
      setStatus("submitted")
      setNotes("")
      onOpenChange(false)
    }
  }

  const handleSubmit = async () => {
    if (!buyer || !property) return
    setLoading(true)
    try {
      await OfferService.addOffer({
        buyer_id: buyer.id,
        property_id: property.id,
        offer_type: offerType || null,
        offer_price: offerPrice ? Number(offerPrice) : null,
        status,
        notes: notes || null,
      })
      toast.success("Offer created")
      if (onSuccess) onSuccess()
      handleClose()
    } catch (err) {
      console.error("Error creating offer:", err)
      toast.error("Failed to create offer")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Offer</DialogTitle>
          <DialogDescription>Record a new offer from a buyer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="block mb-1 text-sm font-medium">Buyer</label>
            <BuyerSelector value={buyer} onChange={setBuyer} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Property</label>
            <PropertySelector value={property} onChange={setProperty} />
          </div>
          <div>
            <label htmlFor="offer-type" className="block mb-1 text-sm font-medium">Offer Type</label>
            <Input
              id="offer-type"
              name="offer-type"
              value={offerType}
              onChange={(e) => setOfferType(e.target.value)}
              placeholder="cash"
            />
          </div>
          <div>
            <label htmlFor="offer-price" className="block mb-1 text-sm font-medium">Offer Price</label>
            <Input
              id="offer-price"
              name="offer-price"
              type="number"
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
            />
          </div>
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
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !buyer || !property}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

