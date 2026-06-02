// The audience-selection model shared by the picker (Phase 3a) and the compose
// "To" step (Phase 3b). Phase 3b persists these:
//   segment        → campaigns.segment_id
//   preset/inline  → campaigns.audience_definition (jsonb)

import { SegmentService } from "@/services/segment-service"
import { EMPTY_DEFINITION } from "@/services/segment-service"
import type { SegmentDefinition } from "./types"

export type AudienceSelection =
  | { kind: "segment"; segmentId: string }                       // a saved segment
  | { kind: "preset"; presetId: string; definition: SegmentDefinition }
  | { kind: "inline"; definition: SegmentDefinition }            // one-off, not saved

// Resolve a selection to the SegmentDefinition the preview/resolve APIs accept.
// For a saved segment, fetch its current definition (so edits to the segment are
// reflected). Returns EMPTY_DEFINITION (everyone reachable) if it was removed.
export async function selectionToDefinition(sel: AudienceSelection): Promise<SegmentDefinition> {
  if (sel.kind === "segment") {
    const segment = await SegmentService.getSegment(sel.segmentId)
    return segment?.definition ?? EMPTY_DEFINITION
  }
  return sel.definition
}

// The campaign-draft patch that records an audience selection: a resolved
// buyer_ids snapshot (consumed by the existing send path, unchanged) plus
// provenance — segment_id for saved segments, audience_definition for
// preset/inline — so Phase 3c can re-resolve scheduled sends.
export interface AudiencePatch {
  buyer_ids: string[]
  segment_id: string | null
  audience_definition: SegmentDefinition | null
  audience_preview_count: number
}

// Resolve a selection to its draft patch via POST /api/segments/resolve.
// `fetchImpl` is injectable for tests. Throws if the resolve call fails.
export async function resolveAudienceSelection(
  sel: AudienceSelection,
  channel: "email" | "sms",
  contextCampaignId?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AudiencePatch> {
  const definition = await selectionToDefinition(sel)
  const res = await fetchImpl("/api/segments/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ definition, channel, contextCampaignId }),
  })
  if (!res.ok) throw new Error(`Audience resolve failed (${res.status})`)
  const { buyerIds, count } = await res.json()
  return {
    buyer_ids: Array.isArray(buyerIds) ? buyerIds : [],
    segment_id: sel.kind === "segment" ? sel.segmentId : null,
    audience_definition: sel.kind === "segment" ? null : definition,
    audience_preview_count: typeof count === "number" ? count : 0,
  }
}
