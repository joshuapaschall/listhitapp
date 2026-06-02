"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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

export default function AddConditionMenu({ channel, onAdd }: AddConditionMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add condition
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search conditions…" />
          <CommandList>
            <CommandEmpty>No conditions found.</CommandEmpty>
            <CommandGroup heading="Who they are">
              {ATTRIBUTE_CATALOG.map((spec) => (
                <CommandItem
                  key={`attr-${spec.field}`}
                  value={`attr ${spec.label}`}
                  onSelect={() => {
                    onAdd(defaultAttributeCondition(spec.field))
                    setOpen(false)
                  }}
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
                      onAdd(defaultBehavioralCondition(spec.metric))
                      setOpen(false)
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
      </PopoverContent>
    </Popover>
  )
}
