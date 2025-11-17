"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import BuyerSelector from "@/components/buyers/buyer-selector"
import PropertySelector from "@/components/buyers/property-selector"
import type { Buyer, Property, Showing } from "@/lib/supabase"
import { ShowingService } from "@/services/showing-service"
import { toast } from "sonner"
import DeleteShowingModal from "./delete-showing-modal"

interface EditShowingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  showing: Showing | null
  onSuccess?: () => void
}

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
]

export default function EditShowingModal({ open, onOpenChange, showing, onSuccess }: EditShowingModalProps) {
  const [buyer, setBuyer] = useState<Buyer | null>(null)
  const [property, setProperty] = useState<Property | null>(null)
  const [scheduledAt, setScheduledAt] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("scheduled")
  const [loading, setLoading] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (open && showing) {
      setBuyer(showing.buyers ?? null)
      setProperty(showing.properties ?? null)
      setScheduledAt(showing.scheduled_at.slice(0, 16))
      setNotes(showing.notes ?? "")
      setStatus(showing.status)
    }
  }, [open, showing])

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false)
    }
  }

  const handleSubmit = async () => {
    if (!showing) return
    if (!scheduledAt) return
    setLoading(true)
    try {
      await ShowingService.updateShowing(showing.id, {
        buyer_id: buyer?.id || null,
        property_id: property?.id || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        status,
        notes: notes || null,
      })
      toast.success("Showing updated")
      if (onSuccess) onSuccess()
      handleClose()
    } catch (err) {
      console.error("Error updating showing:", err)
      toast.error("Failed to update showing")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Showing</DialogTitle>
            <DialogDescription>Update showing details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block mb-1 text-sm font-medium">Buyer</label>
              <BuyerSelector value={buyer} onChange={setBuyer} placeholder="Search buyers..." />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Property</label>
              <PropertySelector value={property} onChange={setProperty} placeholder="Search properties..." />
            </div>
            <div>
              <label htmlFor="edit-scheduled-at" className="block mb-1 text-sm font-medium">Scheduled At</label>
              <Input
                id="edit-scheduled-at"
                name="edit-scheduled-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
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
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" onClick={() => setShowDelete(true)} disabled={loading}>
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading || !scheduledAt}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteShowingModal
        open={showDelete}
        onOpenChange={setShowDelete}
        showing={showing}
        onSuccess={() => {
          if (onSuccess) onSuccess()
          setShowDelete(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}
