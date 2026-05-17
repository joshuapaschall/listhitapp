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
import { Separator } from "@/components/ui/separator"
import BuyerSelector from "@/components/buyers/buyer-selector"
import PropertySelector from "@/components/buyers/property-selector"
import type { Buyer, Property } from "@/lib/supabase"
import { OfferService } from "@/services/offer-service"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Banknote, Building2 } from "lucide-react"

function formatCurrencyInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "")
  const num = parseFloat(cleaned)
  if (isNaN(num)) return ""
  return num.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

function parseCurrencyInput(formatted: string): string {
  return formatted.replace(/,/g, "")
}

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
  const [offerType, setOfferType] = useState("cash")
  const [offerPrice, setOfferPrice] = useState("")
  const [downPayment, setDownPayment] = useState("")
  const [monthlyPayment, setMonthlyPayment] = useState("")
  const [earnestMoney, setEarnestMoney] = useState("")
  const [dueDiligenceDays, setDueDiligenceDays] = useState("")
  const [proposedClosingDate, setProposedClosingDate] = useState("")
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
      setOfferType("cash")
      setOfferPrice("")
      setDownPayment("")
      setMonthlyPayment("")
      setEarnestMoney("")
      setDueDiligenceDays("")
      setProposedClosingDate("")
      setNotes("")
      onOpenChange(false)
    }
  }

  const handleSubmit = async () => {
    if (!buyer || !property || !offerPrice) return
    setLoading(true)
    try {
      await OfferService.addOffer({
        buyer_id: buyer.id,
        property_id: property.id,
        offer_type: offerType || null,
        offer_price: offerPrice ? Number(offerPrice) : null,
        down_payment: downPayment ? Number(downPayment) : null,
        monthly_payment: offerType === "cash" ? null : monthlyPayment ? Number(monthlyPayment) : null,
        earnest_money: earnestMoney ? Number(earnestMoney) : null,
        due_diligence_days: dueDiligenceDays ? Number(dueDiligenceDays) : null,
        proposed_closing_date: proposedClosingDate || null,
        status: "submitted",
        notes: notes || null,
      })
      toast.success("Offer created")
      onSuccess?.()
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Offer</DialogTitle>
          <DialogDescription>Record a new offer from a buyer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buyer & Property</p>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Buyer <span className="text-destructive">*</span></label>
              <BuyerSelector value={buyer} onChange={setBuyer} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Property <span className="text-destructive">*</span></label>
              <PropertySelector value={property} onChange={setProperty} />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Offer Details</p>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Offer Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOfferType("cash")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all",
                    offerType === "cash"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50",
                  )}
                >
                  <Banknote className="h-4 w-4" />
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setOfferType("financing")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all",
                    offerType === "financing"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50",
                  )}
                >
                  <Building2 className="h-4 w-4" />
                  Financing
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="offer-price" className="mb-1.5 block text-sm font-medium">
                Offer Price <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  id="offer-price"
                  name="offer-price"
                  type="text"
                  inputMode="decimal"
                  className="pl-7"
                  placeholder="0"
                  value={offerPrice ? formatCurrencyInput(offerPrice) : ""}
                  onChange={(e) => setOfferPrice(parseCurrencyInput(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="down-payment" className="mb-1.5 block text-sm font-medium">Down Payment</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="down-payment"
                    type="text"
                    inputMode="decimal"
                    className="pl-7"
                    placeholder="0"
                    value={downPayment ? formatCurrencyInput(downPayment) : ""}
                    onChange={(e) => setDownPayment(parseCurrencyInput(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="earnest-money" className="mb-1.5 block text-sm font-medium">Earnest Money</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="earnest-money"
                    type="text"
                    inputMode="decimal"
                    className="pl-7"
                    placeholder="0"
                    value={earnestMoney ? formatCurrencyInput(earnestMoney) : ""}
                    onChange={(e) => setEarnestMoney(parseCurrencyInput(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {offerType !== "cash" && (
              <div>
                <label htmlFor="monthly-payment" className="mb-1.5 block text-sm font-medium">Monthly Payment</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="monthly-payment"
                    type="text"
                    inputMode="decimal"
                    className="pl-7"
                    placeholder="0"
                    value={monthlyPayment ? formatCurrencyInput(monthlyPayment) : ""}
                    onChange={(e) => setMonthlyPayment(parseCurrencyInput(e.target.value))}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dd-period" className="mb-1.5 block text-sm font-medium">Due Diligence Period</label>
                <div className="relative">
                  <Input
                    id="dd-period"
                    type="number"
                    min="0"
                    className="pr-12"
                    placeholder="0"
                    value={dueDiligenceDays}
                    onChange={(e) => setDueDiligenceDays(e.target.value)}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">days</span>
                </div>
              </div>
              <div>
                <label htmlFor="closing-date" className="mb-1.5 block text-sm font-medium">Proposed Closing</label>
                <Input
                  id="closing-date"
                  type="date"
                  value={proposedClosingDate}
                  onChange={(e) => setProposedClosingDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special terms, contingencies, or notes about this offer..."
              />
            </div>
          </div>

          {buyer && property && offerPrice && (
            <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
              <span className="font-medium">{buyer.full_name || `${buyer.fname || ""} ${buyer.lname || ""}`.trim()}</span>
              {" → "}
              <span className="text-muted-foreground">{property.address}</span>
              {" · "}
              <span className="font-bold">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(offerPrice))}
              </span>
              {" "}
              <span className="text-muted-foreground">{offerType === "cash" ? "Cash" : "Financing"}</span>
              {proposedClosingDate && (
                <>
                  {" · "}
                  <span className="text-muted-foreground">Close {new Date(proposedClosingDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !buyer || !property || !offerPrice}>{loading ? "Submitting..." : "Submit Offer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
