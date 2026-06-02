"use client"

import { useState } from "react"
import { Users } from "lucide-react"
import { cn } from "@/lib/utils"
import GroupTreeSelector from "@/components/buyers/group-tree-selector"
import AudiencePicker from "@/components/segments/audience-picker"
import type { AudienceSelection } from "@/lib/segments/audience"

type Mode = "groups" | "segments"

interface CampaignAudienceStepProps {
  channel: "email" | "sms"
  campaign: any
  update: (patch: any) => void
  audienceSelection: AudienceSelection | null
  onAudienceChange: (sel: AudienceSelection) => void
  recipientCount: number
}

// Shared "To" step used by both compose views. Groups are the default path;
// segments are a second option behind a toggle. Only ONE audience mechanism is
// ever active — switching modes clears the other so the send path (which already
// reads group_ids OR segment_id/audience_definition) behaves unchanged.
export default function CampaignAudienceStep({
  channel,
  campaign,
  update,
  audienceSelection,
  onAudienceChange,
  recipientCount,
}: CampaignAudienceStepProps) {
  // Open in whichever mode the campaign already reflects; default to groups.
  const startsInSegments = !!campaign.segment_id || !!campaign.audience_definition
  const [mode, setMode] = useState<Mode>(startsInSegments ? "segments" : "groups")

  const switchTo = (next: Mode) => {
    if (next === mode) return
    if (next === "groups") {
      // Clear the audience fields so groups is the single source of truth.
      if (campaign.segment_id || campaign.audience_definition || campaign.audience_preview_count != null) {
        update({ segment_id: null, audience_definition: null, audience_preview_count: null })
      }
    } else {
      // Clear group selection so segments is the single source of truth.
      if ((campaign.group_ids?.length || 0) > 0) update({ group_ids: [] })
    }
    setMode(next)
  }

  const hasAudience = recipientCount > 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[15px] font-medium leading-tight">Who&apos;s this going to?</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Pick a saved group, or target by behaviour.
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium tabular-nums",
            hasAudience
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {hasAudience ? `${recipientCount.toLocaleString()} reachable` : "No one selected yet"}
        </span>
      </div>

      {/* Segmented control */}
      <div className="inline-flex w-full max-w-xs items-center rounded-lg bg-muted p-1 text-sm">
        {(["groups", "segments"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchTo(m)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 font-medium transition-colors",
              mode === m
                ? "border border-border bg-background text-emerald-700 shadow-sm dark:text-emerald-300"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "groups" ? "Saved groups" : "Segments"}
          </button>
        ))}
      </div>

      {/* Mode content */}
      {mode === "groups" ? (
        <div className="space-y-4">
          <GroupTreeSelector
            variant="premium"
            value={campaign.group_ids || []}
            onChange={(ids) => update({ group_ids: ids })}
          />
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <span className="text-xs text-muted-foreground">
              Live estimate — final audience locks when this sends
            </span>
          </div>
        </div>
      ) : (
        <AudiencePicker
          channel={channel}
          value={audienceSelection}
          contextCampaignId={campaign.id}
          onChange={onAudienceChange}
        />
      )}
    </div>
  )
}
