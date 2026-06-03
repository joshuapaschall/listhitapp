"use client"

import { Mail, MessageSquare } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface CampaignChannelPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (channel: "email" | "sms") => void
}

const cardClass =
  "group flex h-full cursor-pointer flex-col rounded-lg border border-border bg-background p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-tint))] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-ring))] focus-visible:ring-offset-2"

const chipClass =
  "mb-4 flex size-11 items-center justify-center rounded-full bg-[hsl(var(--brand-tint))] text-[hsl(var(--brand))]"

export default function CampaignChannelPicker({
  open,
  onOpenChange,
  onSelect,
}: CampaignChannelPickerProps) {
  const pick = (channel: "email" | "sms") => {
    onSelect(channel)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a campaign</DialogTitle>
          <DialogDescription>Choose how you want to reach your buyers.</DialogDescription>
        </DialogHeader>
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button type="button" className={cardClass} onClick={() => pick("email")}>
            <div className={chipClass}>
              <Mail className="size-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Email campaign</h3>
            <p className="mt-2 text-sm text-muted-foreground">Rich, designed emails with images and templates.</p>
          </button>
          <button type="button" className={cardClass} onClick={() => pick("sms")}>
            <div className={chipClass}>
              <MessageSquare className="size-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">SMS campaign</h3>
            <p className="mt-2 text-sm text-muted-foreground">Short text messages that land directly on their phone.</p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
