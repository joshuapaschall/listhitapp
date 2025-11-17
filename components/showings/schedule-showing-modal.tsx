"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import BuyerSelector from "@/components/buyers/buyer-selector"
import PropertySelector from "@/components/buyers/property-selector"
import type { Buyer, Property } from "@/lib/supabase"
import { ShowingService } from "@/services/showing-service"
import { toast } from "sonner"

interface ScheduleShowingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  buyer?: Buyer | null
  property?: Property | null
}

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
]

export default function ScheduleShowingModal({ open, onOpenChange, onSuccess, buyer: defaultBuyer = null, property: defaultProperty = null }: ScheduleShowingModalProps) {
  const [buyer, setBuyer] = useState<Buyer | null>(defaultBuyer)
  const [property, setProperty] = useState<Property | null>(defaultProperty)
  const [scheduledAt, setScheduledAt] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("scheduled")
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setBuyer(defaultBuyer)
    setProperty(defaultProperty)
    setScheduledAt("")
    setNotes("")
    setStatus("scheduled")
  }

  const handleClose = () => {
    if (!loading) {
      reset()
      onOpenChange(false)
    }
  }

  useEffect(() => {
    if (open) {
      setBuyer(defaultBuyer)
      setProperty(defaultProperty)
    }
  }, [open, defaultBuyer, defaultProperty])

  const handleSubmit = async () => {
    if (!scheduledAt) return
    setLoading(true)
    try {
      await ShowingService.addShowing({
        buyer_id: buyer?.id || null,
        property_id: property?.id || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        status,
        notes: notes || null,
      })
      toast.success("Showing scheduled")
      if (onSuccess) onSuccess()
      handleClose()
    } catch (err) {
      console.error("Error scheduling showing:", err)
      toast.error("Failed to schedule showing")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Showing</DialogTitle>
          <DialogDescription>Select buyer and property to schedule a showing.</DialogDescription>
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
            <label htmlFor="schedule-scheduled-at" className="block mb-1 text-sm font-medium">Scheduled At</label>
            <Input
              id="schedule-scheduled-at"
              name="schedule-scheduled-at"
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
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !scheduledAt}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
