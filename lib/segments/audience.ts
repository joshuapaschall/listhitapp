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
