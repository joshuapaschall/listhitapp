"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Send, Trash2, X } from "lucide-react"
import type { Buyer } from "@/lib/supabase"
import { toast } from "sonner"
import RecipientPicker, { type RecipientValue } from "@/components/messaging/recipient-picker"
import RichTextEditor from "@/components/gmail/rich-text-editor"

interface SendEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  buyer: Buyer | null
  onSuccess?: () => void
}

const buyerName = (b: Buyer) => b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed"

// Treat an editor value that strips to nothing (e.g. "<p></p>" or whitespace) as empty.
const htmlIsEmpty = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length === 0

export default function SendEmailModal({ open, onOpenChange, buyer, onSuccess }: SendEmailModalProps) {
  const [recipient, setRecipient] = useState<RecipientValue | null>(null)
  const [cc, setCc] = useState<RecipientValue | null>(null)
  const [bcc, setBcc] = useState<RecipientValue | null>(null)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)

  // Prefill the recipient from the passed buyer (or clear it for the header case).
  useEffect(() => {
    if (!open) return
    if (buyer) setRecipient({ buyerId: buyer.id, value: buyer.email || "", label: buyerName(buyer) })
    else setRecipient(null)
  }, [open, buyer])

  const to = recipient?.value?.trim() || ""

  const reset = () => {
    setRecipient(null)
    setCc(null)
    setBcc(null)
    setShowCc(false)
    setShowBcc(false)
    setSubject("")
    setBody("")
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const canSend = !!to && !!subject.trim() && !htmlIsEmpty(body) && !sending

  const handleSubmit = async () => {
    if (!canSend) return
    setSending(true)
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          html: body,
          ...(cc?.value ? { cc: cc.value } : {}),
          ...(bcc?.value ? { bcc: bcc.value } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to send email")
      }
      toast.success("Email sent")
      onSuccess?.()
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent className="flex max-h-[88vh] max-w-xl flex-col gap-0 overflow-hidden p-0 [&>button.absolute]:hidden">
        {/* Header strip */}
        <div className="flex items-center justify-between bg-muted px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">New message</span>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4">
          {/* From */}
          <div className="flex items-center gap-2 border-b border-border py-2.5 text-sm">
            <span className="w-14 shrink-0 text-muted-foreground">From</span>
            <span className="truncate text-muted-foreground">Your connected email</span>
          </div>

          {/* To */}
          <div className="flex items-start gap-2 border-b border-border py-2.5">
            <span className="w-14 shrink-0 pt-2 text-sm text-muted-foreground">To</span>
            <div className="min-w-0 flex-1">
              <RecipientPicker mode="email" value={recipient} onChange={setRecipient} />
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-2 text-xs text-muted-foreground">
              {!showCc ? (
                <button type="button" onClick={() => setShowCc(true)} className="hover:text-foreground">
                  Cc
                </button>
              ) : null}
              {!showBcc ? (
                <button type="button" onClick={() => setShowBcc(true)} className="hover:text-foreground">
                  Bcc
                </button>
              ) : null}
            </div>
          </div>

          {/* Cc */}
          {showCc ? (
            <div className="flex items-start gap-2 border-b border-border py-2.5">
              <span className="w-14 shrink-0 pt-2 text-sm text-muted-foreground">Cc</span>
              <div className="min-w-0 flex-1">
                <RecipientPicker mode="email" value={cc} onChange={setCc} placeholder="Cc" />
              </div>
            </div>
          ) : null}

          {/* Bcc */}
          {showBcc ? (
            <div className="flex items-start gap-2 border-b border-border py-2.5">
              <span className="w-14 shrink-0 pt-2 text-sm text-muted-foreground">Bcc</span>
              <div className="min-w-0 flex-1">
                <RecipientPicker mode="email" value={bcc} onChange={setBcc} placeholder="Bcc" />
              </div>
            </div>
          ) : null}

          {/* Subject */}
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            aria-label="Subject"
            className="h-10 shrink-0 rounded-none border-0 border-b border-border px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-hidden py-1">
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Write your message…"
              minHeight={200}
              className="h-full"
              toolbarClassName="border-border"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3">
          <Button variant="brand" onClick={handleSubmit} disabled={!canSend} className="gap-1.5">
            <Send className="h-4 w-4" />
            {sending ? "Sending…" : "Send"}
          </Button>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Discard draft"
            title="Discard"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
