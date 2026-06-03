"use client"

import { Filter, Eye, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CampaignAudienceSnapshot } from "@/lib/campaign-audience"

interface AudienceFilterSummaryCardProps {
  snapshot: CampaignAudienceSnapshot
  onPreview: () => void
  onAdjust: () => void
  onClear: () => void
}

function formatDate(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function AudienceFilterSummaryCard({ snapshot, onPreview, onAdjust, onClear }: AudienceFilterSummaryCardProps) {
  const badges: string[] = []

  if (snapshot.search?.trim()) badges.push(`Search: "${snapshot.search.trim()}"`)
  snapshot.selectedTags?.forEach((tag) => badges.push(`Tag: ${tag}`))
  snapshot.excludeTags?.forEach((tag) => badges.push(`Excluding tag: ${tag}`))
  snapshot.selectedLocations?.forEach((location) => badges.push(`Location: ${location}`))

  if (snapshot.minScore && snapshot.maxScore) {
    badges.push(`Score: ${snapshot.minScore}–${snapshot.maxScore}`)
  } else if (snapshot.minScore) {
    badges.push(`Min score ${snapshot.minScore}`)
  } else if (snapshot.maxScore) {
    badges.push(`Max score ${snapshot.maxScore}`)
  }

  if (snapshot.vip === "vip") badges.push("VIP only")
  if (snapshot.vetted === "vetted") badges.push("Vetted only")
  if (snapshot.canReceiveEmail === "yes") badges.push("Can receive email")
  if (snapshot.canReceiveSMS === "yes") badges.push("Can receive SMS")
  if (snapshot.propertyType && snapshot.propertyType !== "any") badges.push(`Property: ${snapshot.propertyType}`)
  if (snapshot.createdAfter) badges.push(`Added ${formatDate(snapshot.createdAfter)}+`)
  if (snapshot.createdBefore) badges.push(`Added before ${formatDate(snapshot.createdBefore)}`)

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted/40 w-8 h-8 rounded-full flex items-center justify-center">
            <Filter className="h-4 w-4 text-brand" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Filter from buyers</p>
            <p className="text-xs text-muted-foreground">Snapshot of /buyers, {formatTimestamp(snapshot.createdAt)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-foreground">{snapshot.recipientCount}</p>
          <p className="text-xs text-muted-foreground">recipients</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 py-3 border-y mt-3">
        {(badges.length ? badges : ["All filtered buyers"]).map((badge) => (
          <span key={badge} className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {badge}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onPreview}>
            <Eye className="h-4 w-4 mr-1" />
            Preview recipients
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onAdjust}>
            <SlidersHorizontal className="h-4 w-4 mr-1" />
            Adjust filter
          </Button>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
