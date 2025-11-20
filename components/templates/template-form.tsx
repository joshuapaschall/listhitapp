"use client"

import { useMemo, useRef, useState } from "react"
import EmojiPicker from "emoji-picker-react"
import { Smile, Tag } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  const channelLabel =
    channel === "email" ? "Email" : channel === "quick_reply" ? "Quick Reply" : "SMS"

  const { chars, segments } = useMemo(() => {
    return {
      chars: message.length,
      segments: calculateSmsSegments(message),
    }
  }, [message])

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
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-medium">{channelLabel} Template</p>
            <p className="text-xs text-muted-foreground">
              Give this reply a short title and the text you want to reuse.
            </p>
          </div>
          {showCharacterCount && (
            <div className="text-right text-xs text-muted-foreground">
              <p>{chars} characters</p>
              <p className="text-[11px]">{segments} SMS segment{segments === 1 ? "" : "s"}</p>
            </div>
          )}
        </div>
        <div className="space-y-4 px-4 py-3">
          <div>
            <label htmlFor="tpl-name" className="block text-sm font-medium mb-1">Name</label>
            <Input
              id="tpl-name"
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
              {showCharacterCount && (
                <span className="text-xs text-muted-foreground">{chars}/612</span>
              )}
            </div>
            {(enableEmojiPicker || mergeTags.length > 0) && (
              <div className="flex items-center gap-2 text-muted-foreground">
                {enableEmojiPicker && (
                  <DropdownMenu open={showEmoji} onOpenChange={setShowEmoji}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" type="button" aria-label="Insert emoji">
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" type="button" aria-label="Insert merge tag">
                        <Tag className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {mergeTags.map((tag) => (
                        <DropdownMenuItem key={tag.value} onSelect={() => insertPlaceholder(tag.value)}>
                          {tag.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <p className="text-xs">Emojis and merge fields are supported.</p>
              </div>
            )}
            <Textarea
              id="tpl-message"
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="min-h-[140px]"
              placeholder="Type the quick reply you want to drop into conversations..."
            />
            {!message.trim() && (
              <p className="text-xs text-destructive">Message is required</p>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={loading || !name.trim() || !message.trim()}>
          {loading ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  )
}
