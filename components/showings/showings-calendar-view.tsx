"use client"

import { useMemo, useState } from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Buyer, ShowingWithRelations } from "@/lib/supabase"
import ShowingCard from "@/components/showings/showing-card"

interface ShowingsCalendarViewProps {
  showings: ShowingWithRelations[]
  onEdit: (showing: ShowingWithRelations) => void
  onDelete: (showing: ShowingWithRelations) => void
  onBuyerClick: (buyer: Buyer) => void
  onText: (buyer: Buyer) => void
  onCancel: (showing: ShowingWithRelations) => void
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// Event-chip color by status (calm tints, dark-safe).
const CHIP_COLOR: Record<string, string> = {
  scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  completed: "bg-green-500/15 text-green-700 dark:text-green-300",
  rescheduled: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  canceled: "bg-red-500/15 text-red-700 dark:text-red-300",
}

export default function ShowingsCalendarView({
  showings,
  onEdit,
  onDelete,
  onBuyerClick,
  onText,
  onCancel,
}: ShowingsCalendarViewProps) {
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month)),
        end: endOfWeek(endOfMonth(month)),
      }),
    [month],
  )

  const showingsForDay = (day: Date) =>
    showings
      .filter((s) => s.scheduled_at && isSameDay(parseISO(s.scheduled_at), day))
      .sort((a, b) => (a.scheduled_at || "").localeCompare(b.scheduled_at || ""))

  const selectedDayShowings = useMemo(() => showingsForDay(selectedDay), [selectedDay, showings])

  const goToday = () => {
    setMonth(startOfMonth(new Date()))
    setSelectedDay(new Date())
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(subMonths(month, 1))} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-semibold text-foreground">{format(month, "MMMM yyyy")}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 pb-1 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 overflow-hidden rounded-lg border-l border-t border-border">
          {days.map((day) => {
            const inMonth = isSameMonth(day, month)
            const dayShowings = showingsForDay(day)
            const selected = isSameDay(day, selectedDay)
            const today = isToday(day)
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "relative min-h-[92px] border-b border-r border-border p-1.5 text-left align-top transition-colors hover:bg-muted/50",
                  selected && "z-10 bg-brand/5 ring-2 ring-inset ring-brand",
                  !inMonth && "bg-muted/20 text-muted-foreground",
                )}
              >
                <div className="flex justify-end">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      today
                        ? "bg-brand font-semibold text-white"
                        : selected
                          ? "font-semibold text-brand"
                          : inMonth
                            ? "text-foreground"
                            : "text-muted-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="mt-0.5 space-y-0.5">
                  {dayShowings.slice(0, 2).map((s) => {
                    const b = s.buyers
                    const fname = b?.fname || b?.full_name?.split(" ")[0] || "Showing"
                    const time = s.scheduled_at ? format(parseISO(s.scheduled_at), "h:mm a") : ""
                    return (
                      <div key={s.id} className={cn("truncate rounded px-1 py-0.5 text-[10px]", CHIP_COLOR[s.status || "scheduled"] || CHIP_COLOR.scheduled)}>
                        {time} {fname}
                      </div>
                    )
                  })}
                  {dayShowings.length > 2 ? (
                    <div className="px-1 text-[10px] text-muted-foreground">+{dayShowings.length - 2} more</div>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected-day detail */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-foreground">{format(selectedDay, "EEEE, MMMM d")}</p>
          {selectedDayShowings.length > 0 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {selectedDayShowings.length} {selectedDayShowings.length === 1 ? "showing" : "showings"}
            </span>
          ) : null}
        </div>
        {selectedDayShowings.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-10 text-center">
            <p className="text-sm font-medium text-foreground">No showings on this day</p>
            <p className="text-xs text-muted-foreground">Pick another day or schedule a new showing.</p>
          </div>
        ) : (
          selectedDayShowings.map((showing) => (
            <ShowingCard
              key={showing.id}
              showing={showing}
              onEdit={onEdit}
              onDelete={onDelete}
              onBuyerClick={onBuyerClick}
              onText={onText}
              onCancel={onCancel}
            />
          ))
        )}
      </div>
    </div>
  )
}
