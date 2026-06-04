"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { CalendarClock } from "lucide-react"
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
  { value: "rescheduled", label: "Rescheduled" },
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
      <DialogContent className="max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <CalendarClock className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-base">Schedule showing</DialogTitle>
              <DialogDescription className="text-xs">Pick a buyer and property, then set the date and status.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Buyer</label>
            <BuyerSelector value={buyer} onChange={setBuyer} placeholder="Search buyers..." />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Property</label>
            <PropertySelector value={property} onChange={setProperty} placeholder="Search properties..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="schedule-scheduled-at" className="block text-sm font-medium">Date &amp; time</label>
              <Input
                id="schedule-scheduled-at"
                name="schedule-scheduled-at"
                type="datetime-local"
                className="h-9"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9">
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
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access details, special instructions..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSubmit} disabled={loading || !scheduledAt}>
            {loading ? "Saving..." : "Schedule showing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
