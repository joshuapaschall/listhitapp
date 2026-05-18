"use client"

import { useMemo, useState } from "react"
import { Calendar, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
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

const TIME_OPTIONS = Array.from({ length: 24 }).map((_, i) => {
  const h12 = i % 12 === 0 ? 12 : i % 12
  const ampm = i < 12 ? "AM" : "PM"
  const value = `${String(i).padStart(2, "0")}:00`
  const label = `${h12}:00 ${ampm}`
  return { value, label }
})

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function presetIsoIn(hours: number): string {
  const d = new Date()
  d.setHours(d.getHours() + hours)
  d.setMinutes(0, 0, 0)
  return d.toISOString()
}

function nextWeekday(targetDow: number, hour: number): string {
  const d = new Date()
  const delta = (targetDow - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + delta)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export default function SmsSendTimeCard(props: SmsSendTimeCardProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const hasError = useMemo(() => !!(props.runFrom && props.runUntil && props.runFrom >= props.runUntil), [props.runFrom, props.runUntil])
  const mode: "now" | "scheduled" = props.scheduledAt ? "scheduled" : "now"

  const setMode = (next: "now" | "scheduled") => {
    if (next === "now") props.onScheduledAtChange(null)
    else if (!props.scheduledAt) props.onScheduledAtChange(presetIsoIn(1))
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border bg-muted/30 p-1">
        <button type="button" onClick={() => setMode("now")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === "now" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Send now</button>
        <button type="button" onClick={() => setMode("scheduled")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === "scheduled" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Schedule for later</button>
      </div>

      {mode === "scheduled" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => props.onScheduledAtChange(presetIsoIn(1))}>In 1 hour</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => props.onScheduledAtChange(nextWeekday(new Date().getDay(), 9))}>Tomorrow 9 AM</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => props.onScheduledAtChange(nextWeekday(1, 10))}>Monday 10 AM</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => props.onScheduledAtChange(nextWeekday(4, 13))}>Thursday 1 PM</Button>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Calendar className="h-3 w-3" />Or pick a custom time</label>
            <Input type="datetime-local" value={toLocalDatetimeInput(props.scheduledAt)} onChange={(e) => props.onScheduledAtChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />
            <p className="text-xs text-muted-foreground">Times in {tz}</p>
          </div>
        </>
      )}

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand/80">
          <Clock className="h-3.5 w-3.5" />
          Throttle window
          <span className="text-xs">{advancedOpen ? "▴" : "▾"}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <p className="text-xs text-muted-foreground">Restrict when the system actually sends — useful for staying within business hours.</p>
          <div className="flex items-center gap-2 rounded-md border p-3"><Switch checked={!!props.weekdayOnly} onCheckedChange={props.onWeekdayOnlyChange} /><span className="text-sm">Send Monday through Friday only</span></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Run from</label><Select value={props.runFrom ?? "none"} onValueChange={(v) => props.onRunFromChange(v === "none" ? null : v)}><SelectTrigger><SelectValue placeholder="No start limit" /></SelectTrigger><SelectContent><SelectItem value="none">No start limit</SelectItem>{TIME_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Run until</label><Select value={props.runUntil ?? "none"} onValueChange={(v) => props.onRunUntilChange(v === "none" ? null : v)}><SelectTrigger><SelectValue placeholder="No end limit" /></SelectTrigger><SelectContent><SelectItem value="none">No end limit</SelectItem>{TIME_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          {hasError && <p className="text-sm text-red-600">Run From must be before Run Until</p>}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
