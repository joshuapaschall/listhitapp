"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { ATTRIBUTE_CATALOG, BEHAVIORAL_CATALOG } from "@/lib/segments/catalog"
import { defaultAttributeCondition, defaultBehavioralCondition } from "@/lib/segments/condition-utils"
import type { SegmentCondition } from "@/lib/segments/types"

interface AddConditionMenuProps {
  channel: "email" | "sms" | "both"
  onAdd: (cond: SegmentCondition) => void
}

// A metric is selectable only if relevant to the active channel ("both" = all).
function metricEnabled(channels: ("email" | "sms")[], channel: "email" | "sms" | "both") {
  return channel === "both" || channels.includes(channel)
}

// The palette renders INLINE, in the normal document flow inside the builder
// Sheet — not in a floating portal. Living inside the Sheet's allowed scroll
// region means react-remove-scroll no longer swallows wheel/arrow events, so
// mouse-wheel scrolling and ↑/↓/Enter keyboard navigation work natively.
export default function AddConditionMenu({ channel, onAdd }: AddConditionMenuProps) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add condition
      </Button>
    )
  }

  const pick = (cond: SegmentCondition) => {
    onAdd(cond)
    setOpen(false)
  }

  return (
    <div className="rounded-lg border bg-popover shadow-sm">
      <Command className="bg-transparent">
        <div className="flex items-center gap-1 pr-1">
          <CommandInput placeholder="Search conditions…" autoFocus className="h-10" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CommandList className="max-h-[300px] overflow-y-auto">
          <CommandEmpty>No conditions found.</CommandEmpty>
          <CommandGroup heading="Who they are">
            {ATTRIBUTE_CATALOG.map((spec) => (
              <CommandItem
                key={`attr-${spec.field}`}
                value={`attr ${spec.label}`}
                onSelect={() => pick(defaultAttributeCondition(spec.field))}
              >
                {spec.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="What they did (campaign activity)">
            {BEHAVIORAL_CATALOG.map((spec) => {
              const enabled = metricEnabled(spec.channels, channel)
              return (
                <CommandItem
                  key={`beh-${spec.metric}`}
                  value={`activity ${spec.label}`}
                  disabled={!enabled}
                  onSelect={() => {
                    if (!enabled) return
                    pick(defaultBehavioralCondition(spec.metric))
                  }}
                >
                  <span className="capitalize">{spec.label}</span>
                  {!enabled && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {spec.channels.join("/")} only
                    </span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}
