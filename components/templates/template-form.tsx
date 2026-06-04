"use client"

import { useMemo, useRef, useState } from "react"
import EmojiPicker from "emoji-picker-react"
import { Smile } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { insertText } from "@/lib/utils"
import { calculateSmsSegments } from "@/lib/sms-utils"

interface TemplateFormProps {
  initial?: { name: string; message: string }
  channel?: "sms" | "email" | "quick_reply"
  onSubmit: (data: { name: string; message: string }) => Promise<void>
  mergeTags?: { label: string; value: string }[]
  enableEmojiPicker?: boolean
  showCharacterCount?: boolean
}

// Sample values used for the live SMS preview bubble; unknown tokens fall back
// to the bare field name.
const SAMPLE_VALUES: Record<string, string> = {
  first_name: "John",
  last_name: "Doe",
  phone: "(555) 123-4567",
  email: "john@example.com",
}

export default function TemplateForm({
  initial,
  channel = "sms",
  onSubmit,
  mergeTags = [],
  enableEmojiPicker = false,
  showCharacterCount = false,
}: TemplateFormProps) {
  const [name, setName] = useState(initial?.name || "")
  const [message, setMessage] = useState(initial?.message || "")
  const [loading, setLoading] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const isSms = channel === "sms"
  const isQuickReply = channel === "quick_reply"
  const channelLabel = channel === "email" ? "Email" : isQuickReply ? "Quick reply" : "SMS"

  const chars = message.length
  const { segments: smsSegments, remaining, encoding } = useMemo(
    () => calculateSmsSegments(message),
    [message],
  )

  const previewText = useMemo(
    () => message.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => SAMPLE_VALUES[key] ?? key),
    [message],
  )

  const insertPlaceholder = (value: string) => {
    setMessage((prev) => {
      const textarea = textareaRef.current
      if (!textarea) return prev + value
      const start = textarea.selectionStart ?? prev.length
      const end = textarea.selectionEnd ?? prev.length
      const { value: next, position } = insertText(prev, value, start, end)
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(position, position)
      })
      return next
    })
  }

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
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">{channelLabel} template</p>
            <p className="text-xs text-muted-foreground">
              Give this template a short title and the text you want to reuse.
            </p>
          </div>
          {isSms ? (
            <div className="text-right text-xs text-muted-foreground">
              <p>{chars} characters</p>
              <p className="text-[11px]">{smsSegments} SMS segment{smsSegments === 1 ? "" : "s"}</p>
              <p className="text-[11px] capitalize">Encoding: {encoding}</p>
            </div>
          ) : (isQuickReply || showCharacterCount) ? (
            <div className="text-right text-xs text-muted-foreground">
              <p>{chars} characters</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4 px-4 py-3">
          <div>
            <label htmlFor="tpl-name" className="mb-1 block text-sm font-medium">Name</label>
            <Input
              id="tpl-name"
              className="h-9"
              placeholder="Ex: Warm follow-up"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {!name.trim() && (
              <p className="text-xs text-destructive">Name is required</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="tpl-message" className="block text-sm font-medium">
                Message
              </label>
              {isSms ? (
                <span className="text-xs text-muted-foreground">{remaining} characters left in segment</span>
              ) : null}
            </div>

            {/* Insert field + emoji controls */}
            {(enableEmojiPicker || mergeTags.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {enableEmojiPicker && (
                  <DropdownMenu open={showEmoji} onOpenChange={setShowEmoji}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" type="button" className="h-8 w-8" aria-label="Insert emoji">
                        <Smile className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="p-0" align="start">
                      <EmojiPicker
                        onEmojiClick={(e) => insertPlaceholder(e.emoji)}
                        width="100%"
                        height={320}
                        searchDisabled
                        lazyLoadEmojis
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {mergeTags.length > 0 && (
                  <>
                    <span className="mr-0.5 text-xs text-muted-foreground">Insert field:</span>
                    {mergeTags.map((tag) => (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => insertPlaceholder(tag.value)}
                        className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-brand/10 hover:text-brand"
                      >
                        {tag.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            <Textarea
              id="tpl-message"
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="min-h-[140px]"
              placeholder="Type the message you want to reuse..."
            />
            {!message.trim() && (
              <p className="text-xs text-destructive">Message is required</p>
            )}

            {/* Live SMS phone preview */}
            {isSms && (
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
                <div className="flex justify-end">
                  <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-sm text-white">
                    {previewText || "Your message preview will appear here."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="brand" disabled={loading || !name.trim() || !message.trim()}>
          {loading ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  )
}
