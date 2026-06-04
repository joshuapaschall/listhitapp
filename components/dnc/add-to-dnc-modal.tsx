"use client"

import { useEffect, useState } from "react"
import { Search, Loader2 } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDebounce } from "@/hooks/use-debounce"
import { BuyerService } from "@/services/buyer-service"
import { normalizePhone, formatPhoneDisplay } from "@/lib/dedup-utils"
import { toast } from "sonner"
import type { Buyer } from "@/lib/supabase"

interface DncBuyer {
  id: string
  full_name?: string | null
  fname?: string | null
  lname?: string | null
  phone?: string | null
  email?: string | null
}

interface AddToDncModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  buyer?: DncBuyer | null
  onAdded?: () => void
}

const REASONS = [
  "Requested removal",
  "Complaint",
  "Bad fit",
  "Other",
]

const buyerName = (b: DncBuyer) =>
  b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed buyer"

export default function AddToDncModal({ open, onOpenChange, buyer, onAdded }: AddToDncModalProps) {
  const [step, setStep] = useState<"search" | "channels">("search")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Buyer[]>([])
  const [searching, setSearching] = useState(false)
  const [target, setTarget] = useState<{ buyerId?: string; phone?: string; label: string } | null>(null)
  const [channels, setChannels] = useState({ sms: true, email: true, calls: true })
  const [reason, setReason] = useState(REASONS[0])
  const [submitting, setSubmitting] = useState(false)
  const debouncedQuery = useDebounce(query, 350)

  // Reset on open; jump straight to the channel picker when a buyer is supplied.
  useEffect(() => {
    if (!open) return
    setChannels({ sms: true, email: true, calls: true })
    setReason(REASONS[0])
    setQuery("")
    setResults([])
    if (buyer) {
      setTarget({ buyerId: buyer.id, label: buyerName(buyer) })
      setStep("channels")
    } else {
      setTarget(null)
      setStep("search")
    }
  }, [open, buyer])

  useEffect(() => {
    if (!open || step !== "search") return
    const q = debouncedQuery.trim()
    if (!q) {
      setResults([])
      return
    }
    let active = true
    setSearching(true)
    BuyerService.searchBuyers(q)
      .then((rows) => active && setResults(rows || []))
      .catch(() => active && setResults([]))
      .finally(() => active && setSearching(false))
    return () => {
      active = false
    }
  }, [debouncedQuery, open, step])

  const pickBuyer = (b: Buyer) => {
    setTarget({ buyerId: b.id, label: buyerName(b as DncBuyer) })
    setStep("channels")
  }

  const pickRawPhone = () => {
    const raw = query.trim()
    setTarget({ phone: raw, label: formatPhoneDisplay(raw) || raw })
    setStep("channels")
  }

  const rawPhoneValid = !!normalizePhone(query.trim())
  const isRawPhone = !!target?.phone

  const confirm = async () => {
    if (!target) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/dnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId: target.buyerId,
          phone: target.phone,
          channels,
          reason,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to add to DNC")
      }
      toast.success("Added to Do Not Contact")
      onAdded?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add to DNC")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Do Not Contact</DialogTitle>
          <DialogDescription>
            {step === "search"
              ? "Search a contact, or add a raw phone number."
              : "Choose which channels to suppress."}
          </DialogDescription>
        </DialogHeader>

        {step === "search" ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, phone, or email"
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {searching ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </div>
              ) : (
                results.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => pickBuyer(b)}
                    className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-muted"
                  >
                    <span className="text-sm font-medium text-foreground">{buyerName(b as DncBuyer)}</span>
                    <span className="text-xs text-muted-foreground">
                      {[formatPhoneDisplay(b.phone || "") || b.phone, b.email].filter(Boolean).join(" · ") || "No contact info"}
                    </span>
                  </button>
                ))
              )}
              {!searching && query.trim() && results.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">No contacts found.</p>
              )}
            </div>
            {rawPhoneValid && (
              <Button type="button" variant="outline" className="w-full" onClick={pickRawPhone}>
                Add &quot;{query.trim()}&quot; as a raw phone
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Adding</span>{" "}
              <span className="font-medium text-foreground">{target?.label}</span>
            </div>

            {isRawPhone ? (
              <p className="text-sm text-muted-foreground">
                This number has no contact record — it&apos;ll be added to the SMS blocklist so future
                imports and inbound replies stay suppressed.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dnc-sms">SMS</Label>
                  <Switch id="dnc-sms" checked={channels.sms} onCheckedChange={(v) => setChannels((c) => ({ ...c, sms: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="dnc-email">Email</Label>
                  <Switch id="dnc-email" checked={channels.email} onCheckedChange={(v) => setChannels((c) => ({ ...c, email: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="dnc-calls">Calls</Label>
                  <Switch id="dnc-calls" checked={channels.calls} onCheckedChange={(v) => setChannels((c) => ({ ...c, calls: v }))} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "channels" && !buyer ? (
            <Button type="button" variant="ghost" onClick={() => setStep("search")} disabled={submitting}>
              Back
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          {step === "channels" ? (
            <Button type="button" variant="brand" onClick={confirm} disabled={submitting || (!isRawPhone && !channels.sms && !channels.email && !channels.calls)}>
              {submitting ? "Adding…" : "Add to DNC"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
