"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { addDays, format } from "date-fns"
import { CalendarClock, CalendarDays, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
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

// Quick-fill time slots — each writes the time portion of `scheduledAt`.
const TIME_CHIPS = [
  { label: "9:00 AM", value: "09:00" },
  { label: "11:00 AM", value: "11:00" },
  { label: "1:00 PM", value: "13:00" },
  { label: "3:00 PM", value: "15:00" },
  { label: "5:00 PM", value: "17:00" },
]

export default function ScheduleShowingModal({ open, onOpenChange, onSuccess, buyer: defaultBuyer = null, property: defaultProperty = null }: ScheduleShowingModalProps) {
  const [buyer, setBuyer] = useState<Buyer | null>(defaultBuyer)
  const [property, setProperty] = useState<Property | null>(defaultProperty)
  const [scheduledAt, setScheduledAt] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("scheduled")
  const [loading, setLoading] = useState(false)
  const [pickDate, setPickDate] = useState(false)

  const reset = () => {
    setBuyer(defaultBuyer)
    setProperty(defaultProperty)
    setScheduledAt("")
    setNotes("")
    setStatus("scheduled")
    setPickDate(false)
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

  // Compose `scheduledAt` ("YYYY-MM-DDTHH:mm") from a chosen date + time, keeping
  // whichever part the user hasn't touched yet (defaults: today / 9:00 AM).
  const datePart = scheduledAt.slice(0, 10)
  const timePart = scheduledAt.slice(11, 16)
  const setDatePart = (dateStr: string) => setScheduledAt(`${dateStr}T${timePart || "09:00"}`)
  const setTimePart = (timeStr: string) => setScheduledAt(`${datePart || format(new Date(), "yyyy-MM-dd")}T${timeStr}`)

  const todayStr = format(new Date(), "yyyy-MM-dd")
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd")

  const buyerName = buyer ? (buyer.full_name || `${buyer.fname || ""} ${buyer.lname || ""}`.trim() || "Buyer") : ""
  const buyerInitials = buyer ? (`${buyer.fname?.[0] || ""}${buyer.lname?.[0] || ""}`.toUpperCase() || "?") : "?"
  const propImg = (property as any)?.property_images?.[0]?.image_url as string | undefined

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
          {/* Buyer */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Buyer</label>
            {buyer ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">{buyerInitials}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{buyerName}</div>
                  {buyer.phone ? <div className="truncate text-xs text-muted-foreground">{buyer.phone}</div> : null}
                </div>
                <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setBuyer(null)}>Change</Button>
              </div>
            ) : (
              <BuyerSelector value={buyer} onChange={setBuyer} placeholder="Search buyers..." />
            )}
          </div>

          {/* Property */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Property</label>
            {property ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
                <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {propImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={propImg} alt={property.address || "Property"} className="h-full w-full object-cover" />
                  ) : (
                    <Home className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{property.address || "Property"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {`${property.city || ""}${property.state ? ", " + property.state : ""} · ${property.price ? "$" + property.price.toLocaleString() : ""} · ${property.bedrooms || 0}bd/${property.bathrooms || 0}ba`}
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setProperty(null)}>Change</Button>
              </div>
            ) : (
              <PropertySelector value={property} onChange={setProperty} placeholder="Search properties..." />
            )}
          </div>

          {/* When */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">When</label>
            {/* Date presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => { setPickDate(false); setDatePart(todayStr) }}
                className={cn("rounded-md border px-3 py-1.5 text-sm font-medium transition-colors", datePart === todayStr ? "border-brand bg-brand/10 text-brand" : "border-border text-muted-foreground hover:text-foreground")}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => { setPickDate(false); setDatePart(tomorrowStr) }}
                className={cn("rounded-md border px-3 py-1.5 text-sm font-medium transition-colors", datePart === tomorrowStr ? "border-brand bg-brand/10 text-brand" : "border-border text-muted-foreground hover:text-foreground")}
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setPickDate((v) => !v)}
                className={cn("rounded-md border px-3 py-1.5 text-sm font-medium transition-colors", pickDate || (datePart && datePart !== todayStr && datePart !== tomorrowStr) ? "border-brand bg-brand/10 text-brand" : "border-border text-muted-foreground hover:text-foreground")}
              >
                Pick date
              </button>
              {pickDate ? (
                <Input
                  type="date"
                  autoFocus
                  className="h-8 w-40"
                  value={datePart}
                  onChange={(e) => setDatePart(e.target.value)}
                  aria-label="Pick a date"
                />
              ) : null}
            </div>
            {/* Time chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {TIME_CHIPS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTimePart(t.value)}
                  className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", timePart === t.value ? "border-brand bg-brand/10 text-brand" : "border-border text-muted-foreground hover:text-foreground")}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Precise fallback */}
            <Input
              id="schedule-scheduled-at"
              name="schedule-scheduled-at"
              type="datetime-local"
              className="h-9"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          {/* Status — segmented */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Status</label>
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={cn("rounded-md px-2 py-1.5 text-xs font-medium transition-all", status === opt.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access details, special instructions..." />
          </div>

          {/* Summary */}
          <div className="flex items-center gap-2 rounded-lg bg-brand/5 px-3 py-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-brand" />
            <span className="truncate">
              {`${buyerName || "Buyer"} · ${property?.address || "Property"} · ${scheduledAt ? format(new Date(scheduledAt), "EEE, h:mm a") : "Pick a time"}`}
            </span>
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
