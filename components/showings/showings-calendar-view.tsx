"use client"

import { useMemo, useState } from "react"
import { format, isSameDay, parseISO } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import type { Buyer, ShowingWithRelations } from "@/lib/supabase"
import ShowingCard from "@/components/showings/showing-card"

interface ShowingsCalendarViewProps {
  showings: ShowingWithRelations[]
  onEdit: (showing: ShowingWithRelations) => void
  onDelete: (showing: ShowingWithRelations) => void
  onBuyerClick: (buyer: Buyer) => void
}

export default function ShowingsCalendarView({ showings, onEdit, onDelete, onBuyerClick }: ShowingsCalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined)

  const showingsByDate = useMemo(() => {
    const map = new Map<string, ShowingWithRelations[]>()
    showings.forEach((showing) => {
      if (!showing.scheduled_at) {
        return
      }
      const key = format(parseISO(showing.scheduled_at), "yyyy-MM-dd")
      const existing = map.get(key) || []
      map.set(key, [...existing, showing])
    })
    return map
  }, [showings])

  const showingDays = useMemo(() => Array.from(showingsByDate.keys()).map((d) => parseISO(d)), [showingsByDate])

  const selectedDayShowings = useMemo(() => {
    if (!selectedDay) {
      return []
    }
    return showings.filter((showing) => {
      if (!showing.scheduled_at) {
        return false
      }
      return isSameDay(parseISO(showing.scheduled_at), selectedDay)
    })
  }, [selectedDay, showings])

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
        <div className="mx-auto w-full max-w-[350px]">
          <Calendar
            mode="single"
            selected={selectedDay}
            onSelect={setSelectedDay}
            className="rounded-md border"
            modifiers={{ hasShowing: showingDays }}
            modifiersClassNames={{ hasShowing: "showing-dot" }}
          />
        </div>

        <div className="space-y-3">
          {!selectedDay && <p className="text-sm text-muted-foreground">Select a day to see showings</p>}
          {selectedDay && selectedDayShowings.length === 0 && (
            <p className="text-sm text-muted-foreground">No showings on this day</p>
          )}
          {selectedDayShowings.map((showing) => (
            <ShowingCard
              key={showing.id}
              showing={showing}
              onEdit={onEdit}
              onDelete={onDelete}
              onBuyerClick={onBuyerClick}
            />
          ))}
        </div>
      </div>

      <style jsx global>{`
        .showing-dot {
          position: relative;
        }
        .showing-dot::after {
          content: "";
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: hsl(var(--primary));
        }
      `}</style>
    </>
  )
}
