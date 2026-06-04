"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Bath, Bed, KeyRound, MapPin, Ruler, Users } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Can } from "@/components/auth/Can"
import type { Buyer, Property } from "@/lib/supabase"
import { PropertyService } from "@/services/property-service"
import { BuyerService } from "@/services/buyer-service"
import { cn } from "@/lib/utils"
import ScheduleShowingModal from "@/components/showings/schedule-showing-modal"
import DeletePropertyModal from "./delete-property-modal"

interface PropertyDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string | null
  onUpdated?: () => void
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const FINANCE_SUBTYPE_LABEL: Record<string, string> = {
  owner_finance: "Owner finance",
  subject_to: "Subject-to",
  land_contract: "Land contract",
}

const statusStyles: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400",
  under_contract: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  sold: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400",
}

const dealBadge = (p: Property) => {
  if (p.deal_type === "creative") {
    const label = (p.finance_subtype && FINANCE_SUBTYPE_LABEL[p.finance_subtype]) || "Creative"
    return { label, className: "bg-purple-500/10 text-purple-600 dark:text-purple-400" }
  }
  return { label: "Cash", className: "bg-muted text-muted-foreground" }
}

const initialsOf = (b: Buyer) =>
  `${b.fname?.[0] || ""}${b.lname?.[0] || ""}`.toUpperCase() || "?"

const buyerName = (b: Buyer) =>
  b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed buyer"

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export default function PropertyDetailModal({
  open,
  onOpenChange,
  propertyId,
  onUpdated,
}: PropertyDetailModalProps) {
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(false)
  const [matchedBuyers, setMatchedBuyers] = useState<Buyer[]>([])
  const [showSchedule, setShowSchedule] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (open && propertyId) {
      setLoading(true)
      PropertyService.getProperty(propertyId)
        .then((data) => setProperty(data))
        .catch((err) => {
          console.error("Error loading property:", err)
          setProperty(null)
        })
        .finally(() => setLoading(false))
    }
  }, [open, propertyId])

  // Real per-property buyer match — same deal-aware approach as the Add Property wizard.
  useEffect(() => {
    if (!open || !property) {
      setMatchedBuyers([])
      return
    }
    const creative = property.deal_type === "creative"
    const tagHints = [...(property.tags || []), property.buyer_fit].filter(Boolean) as string[]
    BuyerService.getBuyersByCriteria({
      city: property.city || undefined,
      state: property.state || undefined,
      propertyType: property.property_type || undefined,
      dealType: creative ? "creative" : "cash",
      tags: tagHints.length ? tagHints : undefined,
      ...(creative ? {} : { minPrice: property.price ?? undefined, maxPrice: property.price ?? undefined }),
    })
      .then(setMatchedBuyers)
      .catch(() => setMatchedBuyers([]))
  }, [open, property])

  const handleClose = () => {
    if (!loading) {
      setShowSchedule(false)
      setShowDelete(false)
      onOpenChange(false)
    }
  }

  const isCreative = property?.deal_type === "creative"
  const isVacant = (property?.occupancy || "").toLowerCase() === "vacant"
  const spread =
    property && property.buy_price != null && property.price != null
      ? property.price - property.buy_price
      : null
  const badge = property ? dealBadge(property) : null

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-lg">{property?.address || "Property"}</DialogTitle>
              {property?.status ? (
                <Badge className={cn("capitalize", statusStyles[property.status] || "")}>
                  {property.status.replaceAll("_", " ")}
                </Badge>
              ) : null}
              {badge ? (
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge.className)}>{badge.label}</span>
              ) : null}
            </div>
            {property ? (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {[property.city, property.state, property.zip].filter(Boolean).join(", ") || "No location"}
              </p>
            ) : null}
          </DialogHeader>

          {loading && <p className="py-6 text-sm text-muted-foreground">Loading...</p>}

          {!loading && property && (
            <div className="space-y-5 py-1">
              {/* Pricing */}
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                {isCreative ? (
                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">List price</span>
                      <span className="text-xl font-semibold text-foreground">{property.price != null ? usd.format(property.price) : "—"}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Detail label="Down payment" value={property.down_payment != null ? usd.format(property.down_payment) : "—"} />
                      <Detail label="Monthly payment" value={property.monthly_payment != null ? usd.format(property.monthly_payment) : "—"} />
                      <Detail label="Interest rate" value={property.interest_rate != null ? `${property.interest_rate}%` : "—"} />
                      <Detail label="Term" value={property.term_months != null ? `${property.term_months} mo` : "—"} />
                      <Detail label="Balloon" value={property.balloon_months != null ? `${property.balloon_months} mo` : "—"} />
                      {property.finance_subtype === "subject_to" ? (
                        <Detail label="Existing loan balance" value={property.existing_loan_balance != null ? usd.format(property.existing_loan_balance) : "—"} />
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <Detail label="Asking price" value={property.price != null ? usd.format(property.price) : "—"} />
                    <Detail label="Buy price" value={property.buy_price != null ? usd.format(property.buy_price) : "—"} />
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Spread</p>
                      {spread == null ? (
                        <p className="text-sm font-medium text-muted-foreground">—</p>
                      ) : (
                        <p className={cn("text-sm font-medium", spread >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                          {spread >= 0 ? "+" : "−"}{usd.format(Math.abs(spread))}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Details */}
              <div>
                <div className="mb-2 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Bed className="h-4 w-4" />{property.bedrooms ?? 0} bd</span>
                  <span className="flex items-center gap-1"><Bath className="h-4 w-4" />{property.bathrooms ?? 0} ba</span>
                  <span className="flex items-center gap-1"><Ruler className="h-4 w-4" />{(property.sqft || 0).toLocaleString()} sqft</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {property.property_type ? <Detail label="Property type" value={property.property_type} /> : null}
                  {property.condition ? <Detail label="Condition" value={property.condition} /> : null}
                  {property.disposition_strategy ? <Detail label="Strategy" value={property.disposition_strategy} /> : null}
                  {property.buyer_fit ? <Detail label="Buyer fit" value={property.buyer_fit} /> : null}
                  {property.occupancy ? <Detail label="Occupancy" value={property.occupancy} /> : null}
                  {property.priority ? <Detail label="Priority" value={property.priority} /> : null}
                  {isVacant && property.lockbox_code ? (
                    <Detail
                      label="Lockbox code"
                      value={<span className="inline-flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" />{property.lockbox_code}</span>}
                    />
                  ) : null}
                </div>
              </div>

              {property.description ? <p className="text-sm text-muted-foreground">{property.description}</p> : null}

              {property.tags && property.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {property.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              ) : null}

              {property.short_url ? (
                <p className="text-sm">
                  Short link:{" "}
                  <a href={property.short_url} target="_blank" rel="noopener noreferrer" className="text-brand underline">
                    {property.short_url}
                  </a>
                </p>
              ) : null}

              {/* Matched buyers */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/10 text-brand">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">Matched buyers ({matchedBuyers.length})</span>
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                  {matchedBuyers.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No matching buyers for this property yet.</p>
                  ) : (
                    matchedBuyers.map((b) => (
                      <div key={b.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/10 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">{initialsOf(b)}</div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{buyerName(b)}</p>
                            <p className="truncate text-xs text-muted-foreground">{b.mailing_city || "Any city"}{b.mailing_state ? `, ${b.mailing_state}` : ""}</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">{property.buyer_fit || "Match"}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {property && (
            <DialogFooter className="flex justify-end gap-2">
              <Can permission="properties.manage">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/properties/edit/${property.id}`}>Edit</Link>
                </Button>
              </Can>
              <Button variant="outline" size="sm" onClick={() => setShowSchedule(true)}>
                Schedule showing
              </Button>
              <Can permission="properties.manage">
                <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
                  Delete
                </Button>
              </Can>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      <ScheduleShowingModal
        open={showSchedule}
        onOpenChange={setShowSchedule}
        property={property}
        onSuccess={onUpdated}
      />
      <Can permission="properties.manage">
        <DeletePropertyModal
          open={showDelete}
          onOpenChange={setShowDelete}
          property={property}
          onSuccess={() => {
            if (onUpdated) onUpdated()
            handleClose()
          }}
        />
      </Can>
    </>
  )
}
