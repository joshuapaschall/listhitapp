"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Loader2, Plus, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import SegmentBuilder from "./segment-builder"
import SegmentCountBadge from "./segment-count-badge"
import SegmentSummaryPills from "./segment-summary-pills"
import { SegmentService, type Segment, EMPTY_DEFINITION } from "@/services/segment-service"
import { presetsForChannel } from "@/lib/segments/presets"
import { validateDefinition } from "@/lib/segments/resolver"
import type { AudienceSelection } from "@/lib/segments/audience"
import type { SegmentDefinition } from "@/lib/segments/types"
import { toast } from "sonner"

interface AudiencePickerProps {
  channel: "email" | "sms"
  value: AudienceSelection | null
  onChange: (sel: AudienceSelection) => void
  contextCampaignId?: string
}

// A saved segment is usable on a channel when it targets that channel or is
// channel-agnostic (null = both).
function usableOnChannel(seg: Segment, channel: "email" | "sms") {
  return seg.channel == null || seg.channel === channel
}

export default function AudiencePicker({ channel, value, onChange, contextCampaignId }: AudiencePickerProps) {
  const [segments, setSegments] = useState<Segment[]>([])
  const [loadingSegments, setLoadingSegments] = useState(true)

  // Build-custom sheet state.
  const [builderOpen, setBuilderOpen] = useState(false)
  const [draft, setDraft] = useState<SegmentDefinition>(EMPTY_DEFINITION)
  const [saveForReuse, setSaveForReuse] = useState(false)
  const [draftName, setDraftName] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    setLoadingSegments(true)
    SegmentService.listSegments()
      .then((rows) => active && setSegments(rows))
      .catch(() => active && setSegments([]))
      .finally(() => active && setLoadingSegments(false))
    return () => {
      active = false
    }
  }, [])

  const presets = useMemo(() => presetsForChannel(channel), [channel])
  const usableSegments = useMemo(
    () => segments.filter((s) => usableOnChannel(s, channel)),
    [segments, channel],
  )

  // The definition for the live-count footer, derived from the current selection.
  const selectedDefinition: SegmentDefinition | null = useMemo(() => {
    if (!value) return null
    if (value.kind === "preset" || value.kind === "inline") return value.definition
    const seg = segments.find((s) => s.id === value.segmentId)
    return seg?.definition ?? null
  }, [value, segments])

  // A previously-selected saved segment that no longer exists.
  const removedSegment =
    value?.kind === "segment" && !loadingSegments && !segments.some((s) => s.id === value.segmentId)

  const isSelectedSegment = (id: string) => value?.kind === "segment" && value.segmentId === id
  const isSelectedPreset = (id: string) => value?.kind === "preset" && value.presetId === id

  const openBuilder = () => {
    setDraft(value?.kind === "inline" ? value.definition : EMPTY_DEFINITION)
    setSaveForReuse(false)
    setDraftName("")
    setBuilderOpen(true)
  }

  const draftValid = useMemo(() => {
    try {
      validateDefinition(draft)
      return true
    } catch {
      return false
    }
  }, [draft])

  const confirmBuilder = async () => {
    if (!draftValid) return
    const name = draftName.trim()
    if (saveForReuse && name) {
      setSaving(true)
      try {
        const created = await SegmentService.createSegment({ name, channel, definition: draft })
        setSegments((prev) => [created, ...prev])
        onChange({ kind: "segment", segmentId: created.id })
        setBuilderOpen(false)
      } catch (e: any) {
        toast.error(e?.message || "Failed to save segment")
      } finally {
        setSaving(false)
      }
      return
    }
    onChange({ kind: "inline", definition: draft })
    setBuilderOpen(false)
  }

  return (
    <div className="space-y-4">
      {/* Saved segments */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Saved segments</h4>
        {loadingSegments ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : usableSegments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved segments for this channel yet.</p>
        ) : (
          <div className="space-y-2">
            {usableSegments.map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => onChange({ kind: "segment", segmentId: seg.id })}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
                  isSelectedSegment(seg.id)
                    ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30"
                    : "hover:border-emerald-300",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isSelectedSegment(seg.id) && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                    <span className="truncate font-medium">{seg.name}</span>
                  </div>
                  <div className="mt-1">
                    <SegmentSummaryPills definition={seg.definition ?? EMPTY_DEFINITION} max={3} />
                  </div>
                </div>
                <SegmentCountBadge definition={seg.definition ?? EMPTY_DEFINITION} channel={channel} contextCampaignId={contextCampaignId} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preset chips */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Quick segments</h4>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant={isSelectedPreset(preset.id) ? "default" : "outline"}
              size="sm"
              title={preset.description}
              onClick={() =>
                onChange({ kind: "preset", presetId: preset.id, definition: preset.build({ contextCampaignId }) })
              }
            >
              {isSelectedPreset(preset.id) && <Check className="mr-1.5 h-3.5 w-3.5" />}
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Build custom */}
      <div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openBuilder}>
          <Plus className="h-4 w-4" />
          Build a custom segment
        </Button>
        {value?.kind === "inline" && (
          <div className="mt-2">
            <SegmentSummaryPills definition={value.definition} />
          </div>
        )}
      </div>

      {removedSegment && (
        <p className="text-sm text-amber-600">
          (segment removed) —{" "}
          <button type="button" className="underline" onClick={openBuilder}>
            pick another
          </button>
        </p>
      )}

      {/* Live count footer */}
      <div className="flex items-center justify-between gap-3 border-t pt-3">
        {selectedDefinition ? (
          <SegmentCountBadge definition={selectedDefinition} channel={channel} contextCampaignId={contextCampaignId} />
        ) : (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Choose an audience
          </span>
        )}
        <span className="text-xs text-muted-foreground">Live estimate — final audience locks when this sends</span>
      </div>

      {/* Build-custom sheet */}
      <Sheet open={builderOpen} onOpenChange={setBuilderOpen}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Build a custom segment</SheetTitle>
            <SheetDescription>Target this send, or save it for reuse later.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto py-4">
            <div className="rounded-lg border p-4">
              <SegmentBuilder
                value={draft}
                onChange={setDraft}
                channel={channel}
                allowThisCampaign={!!contextCampaignId}
                contextCampaignId={contextCampaignId}
              />
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="save-for-reuse" className="font-medium">
                    Save this segment for reuse
                  </Label>
                  <p className="text-xs text-muted-foreground">Off = one-off audience for just this send.</p>
                </div>
                <Switch id="save-for-reuse" checked={saveForReuse} onCheckedChange={setSaveForReuse} />
              </div>
              {saveForReuse && (
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Segment name"
                />
              )}
            </div>
          </div>

          <SheetFooter className="gap-2 border-t pt-4 sm:justify-end">
            <Button variant="outline" onClick={() => setBuilderOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!draftValid || saving || (saveForReuse && !draftName.trim())}
              onClick={confirmBuilder}
            >
              {saving ? "Saving…" : saveForReuse ? "Save & use" : "Use audience"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
