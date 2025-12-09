"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import CampaignService from "@/services/campaign-service"
import { toast } from "sonner"
import { X } from "lucide-react"
import Image from "next/image"
import {
  ALLOWED_MMS_EXTENSIONS,
  MAX_MMS_SIZE,
  uploadMediaFile,
} from "@/utils/uploadMedia"
import { useSession } from "@/hooks/use-session"

interface SendSmsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  buyer: Buyer | null
  onSuccess?: () => void
}

function displayName(b: Buyer) {
  return b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed"
}

export default function SendSmsModal({ open, onOpenChange, buyer, onSuccess }: SendSmsModalProps) {
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [showEmoji, setShowEmoji] = useState(false)
  const [templates, setTemplates] = useState<{ id: string; name: string; message: string }[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [prompts, setPrompts] = useState<{ id: string; name: string; prompt: string }[]>([])
  const [selectedPrompt, setSelectedPrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { segments: smsSegments, remaining } = calculateSmsSegments(message)
  const hasOversize = attachments.some((f) => f.size > MAX_MMS_SIZE)
  const { user } = useSession()

  useEffect(() => {
    if (open) {
      TemplateService.listTemplates().then(setTemplates)
      PromptService.listPrompts().then(setPrompts)
    }
  }, [open])

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
    const { value, position } = insertText(
      message,
      text,
      textarea.selectionStart,
      textarea.selectionEnd,
    )
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
        const finalPrompt = renderTemplate(p.prompt, buyer)
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
    setMessage("")
    setAttachments([])
    setSelectedTemplate("")
    setSelectedPrompt("")
    setShowEmoji(false)
  }

  const handleClose = () => {
    if (!open) return
    reset()
    onOpenChange(false)
  }

  const handleSubmit = async () => {
    if (!buyer || (!message.trim() && attachments.length === 0)) return
    for (const file of attachments) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      if (!ALLOWED_MMS_EXTENSIONS.includes(ext)) {
        toast.error(`Unsupported file type: ${file.name}`)
        return
      }
      if (file.size > MAX_MMS_SIZE) {
        toast.error(`File ${file.name} exceeds 1MB limit`)
        return
      }
    }
    try {
      const mediaUrls: string[] = []
      for (const file of attachments) {
        const url = await uploadMediaFile(file, "outgoing")
        mediaUrls.push(url)
      }
      const finalMessage = message.trim() ? message : ""
      const campaign = await CampaignService.createCampaign({
        userId: user?.id,
        name: `SMS to ${displayName(buyer)}`,
        channel: "sms",
        message: finalMessage,
        mediaUrls,
        buyerIds: [buyer.id],
        groupIds: [],
        sendToAllNumbers: true,
      })
      await CampaignService.sendNow(campaign.id)
      toast.success("Message sent")
      if (onSuccess) onSuccess()
      handleClose()
    } catch (err) {
      console.error("Failed to send SMS", err)
      toast.error("Failed to send SMS")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send SMS</DialogTitle>
        </DialogHeader>
        {buyer && (
          <p className="text-sm mb-2">To: {displayName(buyer)}</p>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 320))}
            rows={6}
            disabled={generating}
          />
          <div className="flex gap-2 mt-2">
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
                <SelectValue placeholder="Prompt" />
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
                <DropdownMenuItem onSelect={() => insertPlaceholder("{{first_name}}")}>First Name</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => insertPlaceholder("{{last_name}}")}>Last Name</DropdownMenuItem>
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
              Upload Image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_MMS_EXTENSIONS.join(",")}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
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
                    className="h-4 w-4 absolute -right-2 -top-2 bg-white dark:bg-gray-800 rounded-full cursor-pointer"
                    onClick={() => removeAttachment(idx)}
                  />
                </div>
              ))}
            </div>
          )}
          {generating && <p className="text-xs text-muted-foreground">Generating...</p>}
          <div className={`flex justify-between text-xs ${smsSegments > 1 ? "text-red-600" : "text-muted-foreground"}`}>
            <span>
              {remaining} characters remaining · {smsSegments} segment{smsSegments > 1 ? "s" : ""}
            </span>
            {!message.trim() && attachments.length === 0 && (
              <span>Message or attachment required</span>
            )}
          </div>
        </div>
        <DialogFooter className="mt-4">
          {hasOversize && (
            <p className="text-xs text-red-600 mr-auto">
              Remove files over 1MB before sending
            </p>
          )}
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!buyer || (!message.trim() && attachments.length === 0) || hasOversize}
          >
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

