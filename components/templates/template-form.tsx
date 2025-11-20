"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

interface TemplateFormProps {
  initial?: { name: string; message: string }
  channel?: "sms" | "email" | "quick_reply"
  onSubmit: (data: { name: string; message: string }) => Promise<void>
}
export default function TemplateForm({
  initial,
  channel = "sms",
  onSubmit,
}: TemplateFormProps) {
  const [name, setName] = useState(initial?.name || "")
  const [message, setMessage] = useState(initial?.message || "")
  const [loading, setLoading] = useState(false)
  const channelLabel =
    channel === "email" ? "Email" : channel === "quick_reply" ? "Quick Reply" : "SMS"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !message.trim()) return
    setLoading(true)
    try {
      await onSubmit({ name, message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">Channel: {channelLabel}</p>
      <div>
        <label htmlFor="tpl-name" className="block text-sm font-medium mb-1">Name</label>
        <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
        {!name.trim() && (
          <p className="text-xs text-red-600">Name is required</p>
        )}
      </div>
      <div>
        <label htmlFor="tpl-message" className="block text-sm font-medium mb-1">Message</label>
        <Textarea
          id="tpl-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
        />
        {!message.trim() && (
          <p className="text-xs text-red-600">Message is required</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={loading || !name.trim() || !message.trim()}>
          {loading ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  )
}
