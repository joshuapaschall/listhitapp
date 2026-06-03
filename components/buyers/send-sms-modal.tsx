"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import useSWR from "swr"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import EmojiPicker from "emoji-picker-react"
import type { Buyer } from "@/lib/supabase"
import { insertText, renderTemplate } from "@/lib/utils"
import { calculateSmsSegments } from "@/lib/sms-utils"
import { TemplateService } from "@/services/template-service"
import { PromptService } from "@/services/prompt-service"
import { toast } from "sonner"
import { MessageSquare, Send, X } from "lucide-react"
import Image from "next/image"
import {
  ALLOWED_MMS_EXTENSIONS,
  MAX_MMS_SIZE,
  uploadMediaFile,
} from "@/utils/uploadMedia"
import { useMyMergeContext } from "@/hooks/use-my-merge-context"
import RecipientPicker, { type RecipientValue } from "@/components/messaging/recipient-picker"

interface SendSmsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  buyer: Buyer | null
  onSuccess?: () => void
}

function displayName(b: Buyer) {
  return b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed"
}

const STICKY = "__sticky__"
const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())

export default function SendSmsModal({ open, onOpenChange, buyer, onSuccess }: SendSmsModalProps) {
  const [recipient, setRecipient] = useState<RecipientValue | null>(null)
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [showEmoji, setShowEmoji] = useState(false)
  const [templates, setTemplates] = useState<{ id: string; name: string; message: string }[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [prompts, setPrompts] = useState<{ id: string; name: string; prompt: string }[]>([])
  const [selectedPrompt, setSelectedPrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [senderValue, setSenderValue] = useState<string>(STICKY)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { segments: smsSegments, remaining } = calculateSmsSegments(message)
  const hasOversize = attachments.some((f) => f.size > MAX_MMS_SIZE)
  const myMergeContext = useMyMergeContext()

  // Sticky-sender list (same source as the Dialer). Default = automatic sticky.
  const { data: numbersData } = useSWR(open ? "/api/numbers/list" : null, fetcher)
  const fromItems = useMemo(
    () => (Array.isArray(numbersData?.items) ? (numbersData.items as { e164: string; label?: string }[]) : []),
    [numbersData?.items],
  )
  const defaultFrom = typeof numbersData?.defaultFrom === "string" ? numbersData.defaultFrom : ""
  const override = senderValue !== STICKY

  useEffect(() => {
    if (open) {
      TemplateService.listTemplates().then(setTemplates)
      PromptService.listPrompts().then(setPrompts)
      setSenderValue(STICKY)
      setRecipient(buyer ? { buyerId: buyer.id, value: buyer.phone || "", label: displayName(buyer) } : null)
    }
  }, [open, buyer])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length) setAttachments((prev) => [...prev, ...files])
  }

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  const insertPlaceholder = (text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const { value, position } = insertText(message, text, textarea.selectionStart, textarea.selectionEnd)
    setMessage(value.slice(0, 320))
    requestAnimationFrame(() => {
      textarea.setSelectionRange(position, position)
      textarea.focus()
    })
  }

  const insertEmoji = (emoji: string) => {
    insertPlaceholder(emoji)
    setShowEmoji(false)
  }

  const handlePromptSelect = async (val: string) => {
    setSelectedPrompt(val)
    const p = prompts.find((pr) => pr.id === val)
    if (p && buyer) {
      setGenerating(true)
      try {
        const finalPrompt = renderTemplate(p.prompt, buyer, myMergeContext)
        const res = await fetch("/api/openai/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: finalPrompt }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "error")
        const text = data.result as string
        setMessage(text.slice(0, 320))
      } catch (err) {
        console.error("Failed to generate text", err)
        toast.error("Failed to generate text")
      } finally {
        setGenerating(false)
      }
    }
  }

  const reset = () => {
    setRecipient(null)
    setMessage("")
    setAttachments([])
    setSelectedTemplate("")
    setSelectedPrompt("")
    setSenderValue(STICKY)
    setShowEmoji(false)
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const to = recipient?.value?.trim() || ""
  const canSend = !!to && (!!message.trim() || attachments.length > 0) && !hasOversize && !sending

  const handleSubmit = async () => {
    if (!canSend) return
    for (const file of attachments) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      if (!(ALLOWED_MMS_EXTENSIONS as readonly string[]).includes(ext)) {
        toast.error(`Unsupported file type: ${file.name}`)
        return
      }
      if (file.size > MAX_MMS_SIZE) {
        toast.error(`File ${file.name} exceeds 1MB limit`)
        return
      }
    }
    setSending(true)
    try {
      const mediaUrls: string[] = []
      for (const file of attachments) {
        const url = await uploadMediaFile(file, "outgoing")
        mediaUrls.push(url)
      }
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          body: message.trim() ? message : "",
          buyerId: recipient?.buyerId || undefined,
          ...(mediaUrls.length ? { mediaUrls } : {}),
          ...(override ? { from: senderValue } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to send message")
      }
      toast.success("Message sent")
      if (onSuccess) onSuccess()
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden [&>button.absolute]:hidden">
        {/* Header strip */}
        <div className="flex items-center justify-between bg-muted px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquare className="h-4 w-4 text-brand" />
            Send text message
          </span>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4">
          {/* To */}
          <div className="flex items-start gap-2 border-b border-border py-2.5">
            <span className="w-14 shrink-0 pt-2 text-sm text-muted-foreground">To</span>
            <div className="min-w-0 flex-1">
              <RecipientPicker mode="phone" value={recipient} onChange={setRecipient} />
            </div>
          </div>

          {/* From (sticky by default, changeable) */}
          <div className="flex items-center gap-2 border-b border-border py-2.5">
            <span className="w-14 shrink-0 text-sm text-muted-foreground">From</span>
            <div className="min-w-0 flex-1">
              <Select value={senderValue} onValueChange={setSenderValue}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STICKY}>
                    Sticky sender (automatic){defaultFrom ? ` · ${defaultFrom}` : ""}
                  </SelectItem>
                  {fromItems.map((item) => (
                    <SelectItem key={item.e164} value={item.e164} className="font-mono">
                      {item.label ? `${item.label} · ${item.e164}` : item.e164}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!override && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Sticky sender</span>
            )}
          </div>

          {/* Message */}
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 320))}
            disabled={generating}
            placeholder="Type your message…"
            aria-label="Message"
            className="min-h-[160px] resize-none rounded-none border-0 px-0 py-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          {/* Compose controls */}
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <Select
              value={selectedTemplate}
              onValueChange={(val) => {
                setSelectedTemplate(val)
                const t = templates.find((tmp) => tmp.id === val)
                if (t) setMessage(t.message.slice(0, 320))
              }}
            >
              <SelectTrigger className="h-8 w-28">
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedPrompt} onValueChange={handlePromptSelect}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue placeholder="AI assist" />
              </SelectTrigger>
              <SelectContent>
                {prompts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">Fields</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => insertPlaceholder("{{first_name}}")}>First name</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => insertPlaceholder("{{last_name}}")}>Last name</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu open={showEmoji} onOpenChange={setShowEmoji}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">😊</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="p-0">
                <EmojiPicker onEmojiClick={(e) => insertEmoji(e.emoji)} width="100%" height={300} searchDisabled lazyLoadEmojis />
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Add image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_MMS_EXTENSIONS.join(",")}
              className="hidden"
              onChange={handleFileChange}
            />
            <span className={`ml-auto text-xs ${smsSegments > 1 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
              {smsSegments} segment{smsSegments === 1 ? "" : "s"} · {320 - remaining} chars
            </span>
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2">
              {attachments.map((file, idx) => (
                <div key={idx} className="relative inline-block">
                  <Image
                    src={URL.createObjectURL(file)}
                    alt="preview"
                    width={128}
                    height={128}
                    className="max-h-32 rounded-md"
                  />
                  <X
                    className="absolute -right-2 -top-2 h-4 w-4 cursor-pointer rounded-full border border-border bg-card"
                    onClick={() => removeAttachment(idx)}
                  />
                </div>
              ))}
            </div>
          )}
          {generating && <p className="pb-2 text-xs text-muted-foreground">Generating…</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="brand" onClick={handleSubmit} disabled={!canSend} className="gap-1.5">
              <Send className="h-4 w-4" />
              {sending ? "Sending…" : "Send text"}
            </Button>
            {hasOversize && <span className="text-xs text-red-600 dark:text-red-400">Remove files over 1MB</span>}
          </div>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
