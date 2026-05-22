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

const PRESET_OPTIONS = [
  { label: "In 1 hour", value: () => presetIsoIn(1) },
  { label: "Tomorrow 9 AM", value: () => nextWeekday(new Date().getDay(), 9) },
  { label: "Monday 10 AM", value: () => nextWeekday(1, 10) },
  { label: "Thursday 1 PM", value: () => nextWeekday(4, 13) },
]

export default function SmsSendTimeCard(props: SmsSendTimeCardProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const hasError = useMemo(() => !!(props.runFrom && props.runUntil && props.runFrom >= props.runUntil), [props.runFrom, props.runUntil])
  const mode: "now" | "scheduled" = props.scheduledAt ? "scheduled" : "now"

  const setMode = (next: "now" | "scheduled") => {
    if (next === "now") props.onScheduledAtChange(null)
    else if (!props.scheduledAt) props.onScheduledAtChange(presetIsoIn(1))
  }

  // Sending hours|Earliest send|Latest send
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Delivery timing</p>
        <div className="inline-flex rounded-lg border bg-muted/30 p-1">
          <button type="button" onClick={() => setMode("now")} className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${mode === "now" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Send now</button>
          <button type="button" onClick={() => setMode("scheduled")} className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${mode === "scheduled" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Schedule for later</button>
        </div>
        <p className="text-xs text-muted-foreground">Choose whether this campaign goes out immediately or at a planned time.</p>
      </div>

      {mode === "scheduled" && (
        <div className="space-y-4 rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick picks</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_OPTIONS.map((preset) => {
                const selected = props.scheduledAt === preset.value()
                return (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => props.onScheduledAtChange(preset.value())}
                    className={`rounded-full border px-4 ${selected ? "border-emerald-600 bg-[#ECFDF5] text-emerald-700 hover:bg-[#ECFDF5]" : "border-border bg-background text-foreground hover:border-emerald-300 hover:bg-emerald-50"}`}
                  >
                    {preset.label}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Calendar className="h-3 w-3" />Or pick a custom time</label>
            <Input type="datetime-local" value={toLocalDatetimeInput(props.scheduledAt)} onChange={(e) => props.onScheduledAtChange(e.target.value ? new Date(e.target.value).toISOString() : null)} className="bg-background" />
            <p className="text-xs text-muted-foreground">Timezone: {tz}</p>
          </div>
        </div>
      )}

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="rounded-lg border border-border/80 bg-card p-4">
        <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="h-4 w-4 text-[#10B981]" />
            Sending hours
          </span>
          <span className="text-xs text-muted-foreground">{advancedOpen ? "Hide" : "Edit"}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <p className="text-xs text-muted-foreground">Only send during these hours — useful for staying within business hours.</p>
          <div className="rounded-md border bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Send Monday through Friday only</p>
                <p className="text-xs text-muted-foreground">Skip weekends.</p>
              </div>
              <Switch checked={!!props.weekdayOnly} onCheckedChange={props.onWeekdayOnlyChange} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Earliest send time</label>
              <Select value={props.runFrom ?? "none"} onValueChange={(v) => props.onRunFromChange(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="No start limit" /></SelectTrigger>
                <SelectContent><SelectItem value="none">No start limit</SelectItem>{TIME_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Latest send time</label>
              <Select value={props.runUntil ?? "none"} onValueChange={(v) => props.onRunUntilChange(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="No end limit" /></SelectTrigger>
                <SelectContent><SelectItem value="none">No end limit</SelectItem>{TIME_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {hasError && <p className="text-sm text-red-600">Earliest send time must be before latest send time.</p>}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
