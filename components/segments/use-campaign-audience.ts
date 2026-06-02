"use client"

import { useMemo, useRef } from "react"
import { resolveAudienceSelection, type AudienceSelection } from "@/lib/segments/audience"

// Wires the AudiencePicker into a campaign compose draft. Derives the picker's
// value from the persisted campaign fields, and on change writes provenance
// immediately (snappy UI) then debounces a /api/segments/resolve call that
// snapshots buyer_ids + the preview count via `update`.
export function useCampaignAudience(
  campaign: any,
  channel: "email" | "sms",
  update: (patch: any) => void,
) {
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const audienceSelection: AudienceSelection | null = useMemo(() => {
    if (campaign.segment_id) return { kind: "segment", segmentId: campaign.segment_id }
    if (campaign.audience_definition) return { kind: "inline", definition: campaign.audience_definition }
    return null
  }, [campaign.segment_id, campaign.audience_definition])

  const handleAudienceChange = (sel: AudienceSelection) => {
    // Optimistic provenance so the picker reflects the choice without waiting.
    update({
      segment_id: sel.kind === "segment" ? sel.segmentId : null,
      audience_definition: sel.kind === "segment" ? null : sel.definition,
    })

    if (timer.current) clearTimeout(timer.current)
    const mySeq = ++seq.current
    timer.current = setTimeout(async () => {
      try {
        const patch = await resolveAudienceSelection(sel, channel, campaign.id)
        if (mySeq !== seq.current) return // a newer selection superseded this one
        update(patch)
      } catch {
        // Keep the optimistic provenance; the count stays stale on a failed resolve.
      }
    }, 400)
  }

  return { audienceSelection, handleAudienceChange }
}
