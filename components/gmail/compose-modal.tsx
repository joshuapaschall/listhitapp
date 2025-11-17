"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface ComposeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent?: (threadId: string) => void
}

export default function ComposeModal({
  open,
  onOpenChange,
  onSent,
}: ComposeModalProps) {
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    if (!open) return
    setTo("")
    setSubject("")
    setText("")
    setLoading(false)
    onOpenChange(false)
  }

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !text.trim()) return
    setLoading(true)
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text }),
      })
      if (!res.ok) throw new Error("Failed to send email")
      const json = await res.json()
      if (onSent) onSent(json.threadId)
      handleClose()
    } catch (err) {
      console.error("Failed to send email", err)
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Email</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <label htmlFor="compose-to" className="block text-sm font-medium mb-1">To</label>
            <Input
              id="compose-to"
              name="compose-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="compose-subject" className="block text-sm font-medium mb-1">Subject</label>
            <Input
              id="compose-subject"
              name="compose-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading || !to.trim() || !subject.trim() || !text.trim()}
          >
            {loading ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
