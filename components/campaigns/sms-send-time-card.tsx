"use client"

import { useMemo, useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

interface SmsSendTimeCardProps {
  scheduledAt: string | null
  onScheduledAtChange: (value: string | null) => void
  weekdayOnly: boolean | null
  onWeekdayOnlyChange: (value: boolean) => void
  runFrom: string | null
  onRunFromChange: (value: string | null) => void
  runUntil: string | null
  onRunUntilChange: (value: string | null) => void
}

const TIME_OPTIONS = Array.from({ length: 24 }).map((_, i) => `${String(i).padStart(2, "0")}:00`)

export default function SmsSendTimeCard(props: SmsSendTimeCardProps) {
  const [open, setOpen] = useState(false)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const hasError = useMemo(() => !!(props.runFrom && props.runUntil && props.runFrom >= props.runUntil), [props.runFrom, props.runUntil])
  const localValue = props.scheduledAt ? new Date(props.scheduledAt).toISOString().slice(0, 16) : ""

  return <div className="space-y-3">
    <Input type="datetime-local" value={localValue} onChange={(e) => props.onScheduledAtChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />
    <p className="text-xs text-muted-foreground">Times in {tz}</p>
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="text-sm text-brand">Advanced delivery options {open ? "▴" : "▾"}</CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <div className="flex items-center gap-2"><Switch checked={!!props.weekdayOnly} onCheckedChange={props.onWeekdayOnlyChange} /><span className="text-sm">Send Monday through Friday only</span></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={props.runFrom ?? "none"} onValueChange={(v) => props.onRunFromChange(v === "none" ? null : v)}><SelectTrigger><SelectValue placeholder="Run From" /></SelectTrigger><SelectContent><SelectItem value="none">No start limit</SelectItem>{TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
          <Select value={props.runUntil ?? "none"} onValueChange={(v) => props.onRunUntilChange(v === "none" ? null : v)}><SelectTrigger><SelectValue placeholder="Run Until" /></SelectTrigger><SelectContent><SelectItem value="none">No end limit</SelectItem>{TIME_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        </div>
        {hasError && <p className="text-sm text-red-600">Run From must be before Run Until</p>}
      </CollapsibleContent>
    </Collapsible>
  </div>
}
