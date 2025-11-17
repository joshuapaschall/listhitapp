"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import ScheduleShowingModal from "./schedule-showing-modal"
import type { Property, Buyer } from "@/lib/supabase"

interface ScheduleShowingButtonProps {
  property?: Property | null
  buyer?: Buyer | null
  className?: string
}

export default function ScheduleShowingButton({ property = null, buyer = null, className }: ScheduleShowingButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)} className={className} size="sm">
        Schedule Showing
      </Button>
      <ScheduleShowingModal
        open={open}
        onOpenChange={setOpen}
        property={property || undefined}
        buyer={buyer || undefined}
        onSuccess={() => setOpen(false)}
      />
    </>
  )
}
