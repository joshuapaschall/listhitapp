"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TemplateService } from "@/services/template-service"
import TemplateForm from "@/components/templates/template-form"
import type { TemplateRecord } from "@/lib/supabase"
import { toast } from "sonner"

interface QuickReplyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (template: TemplateRecord) => void
  mergeTags?: { label: string; value: string }[]
}

export default function QuickReplyModal({
  open,
  onOpenChange,
  onCreated,
  mergeTags = [],
}: QuickReplyModalProps) {
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: { name: string; message: string }) => {
    setError(null)
    try {
      const tpl = await TemplateService.addTemplate(data, "quick_reply")
      onCreated(tpl)
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      setError("Failed to save template")
      toast.error("Failed to save quick reply")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New quick reply</DialogTitle>
          <DialogDescription>
            Create a reusable quick reply for SMS conversations.
          </DialogDescription>
        </DialogHeader>
        <TemplateForm
          channel="quick_reply"
          onSubmit={handleSubmit}
          initial={{ name: "", message: "" }}
          enableEmojiPicker
          mergeTags={mergeTags}
          showCharacterCount
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
