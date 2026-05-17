"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Minus, X, Maximize2, Minimize2, Paperclip, Trash2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import RichTextEditor from "./rich-text-editor"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Account {
  id: string
  email: string
  is_active: boolean
}

export interface ComposeInitialState {
  to?: string
  cc?: string
  bcc?: string
  subject?: string
  body?: string
  threadId?: string
  inReplyTo?: string
  draftId?: string
}

interface ComposeWindowProps {
  open: boolean
  onClose: () => void
  accounts?: Account[]
  initial?: ComposeInitialState
  onSent?: (threadId: string) => void
}

export default function ComposeWindow({
  open, onClose, accounts = [], initial, onSent,
}: ComposeWindowProps) {
  const queryClient = useQueryClient()
  const activeAccount = accounts.find((a) => a.is_active) || accounts[0]

  const [from, setFrom] = useState<string>(activeAccount?.email || "")
  const [to, setTo] = useState(initial?.to || "")
  const [cc, setCc] = useState(initial?.cc || "")
  const [bcc, setBcc] = useState(initial?.bcc || "")
  const [showCc, setShowCc] = useState(!!initial?.cc)
  const [showBcc, setShowBcc] = useState(!!initial?.bcc)
  const [subject, setSubject] = useState(initial?.subject || "")
  const [body, setBody] = useState(initial?.body || "")
  const [draftId, setDraftId] = useState<string | undefined>(initial?.draftId)
  const [minimized, setMinimized] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])

  useEffect(() => {
    setDraftId(initial?.draftId)
    setTo(initial?.to || "")
    setCc(initial?.cc || "")
    setBcc(initial?.bcc || "")
    setShowCc(!!initial?.cc)
    setShowBcc(!!initial?.bcc)
    setSubject(initial?.subject || "")
    setBody(initial?.body || "")
  }, [initial])

  if (!open) return null

  const canSend = to.trim().length > 0 && subject.trim().length > 0 && body.length > 0 && !sending

  const handleSend = async () => {
    const totalSize = attachments.reduce((sum, file) => sum + file.size, 0) + body.length
    if (totalSize > 5 * 1024 * 1024) {
      toast.error("Attachments must be under 5MB total.")
      return
    }
    setSending(true)
    try {
      let res: Response
      if (draftId && attachments.length === 0) {
        res = await fetch(`/api/gmail/drafts/${draftId}/send`, { method: "POST" })
      } else {
        const formData = new FormData()
        if (from) formData.append("from", from)
        formData.append("to", to)
        if (cc.trim()) formData.append("cc", cc.trim())
        if (bcc.trim()) formData.append("bcc", bcc.trim())
        formData.append("subject", subject)
        formData.append("html", body)
        attachments.forEach((file) => formData.append("attachments", file))
        res = await fetch("/api/gmail/send", { method: "POST", body: formData })
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || "Failed to send")
      }
      const json = await res.json()
      toast.success(draftId ? "Draft sent" : "Email sent")
      queryClient.invalidateQueries({ queryKey: ["gmail-threads"] })
      queryClient.invalidateQueries({ queryKey: ["gmail-labels"] })
      if (onSent && json.threadId) onSent(json.threadId)
      setAttachments([])
      setDraftId(undefined)
      onClose()
    } catch (err: any) {
      toast.error(err.message || "Failed to send")
    } finally {
      setSending(false)
    }
  }

  if (minimized) {
    return (
      <div className="fixed bottom-0 right-6 z-50 w-72 rounded-t-lg border bg-card shadow-lg">
        <button
          onClick={() => setMinimized(false)}
          className="flex w-full items-center justify-between rounded-t-lg px-4 py-2.5 text-sm font-medium hover:bg-muted/50"
        >
          <span className="truncate">{subject || "New Message"}</span>
          <X
            className="h-4 w-4 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setAttachments([]); onClose() }}
          />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col rounded-t-lg border bg-card shadow-2xl",
        expanded
          ? "inset-8 mx-auto max-w-4xl"
          : "bottom-0 right-6 h-[560px] w-[520px]",
      )}
    >
      <div className="flex items-center justify-between rounded-t-lg border-b bg-muted/30 px-4 py-2">
        <h3 className="text-sm font-medium">{draftId ? "Draft" : "New Message"}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(true)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Minimize"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={expanded ? "Restore" : "Expand"}
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => { setAttachments([]); onClose() }}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {accounts.length > 1 && (
        <div className="flex items-center border-b px-4 py-1.5 text-sm">
          <span className="w-12 shrink-0 text-muted-foreground">From</span>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 hover:text-foreground">
              {from}
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {accounts.map((a) => (
                <DropdownMenuItem key={a.id} onSelect={() => setFrom(a.email)}>
                  {a.email}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="flex items-center border-b px-4 py-1.5 text-sm">
        <span className="w-12 shrink-0 text-muted-foreground">To</span>
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Recipients"
          className="flex-1 bg-transparent outline-none"
        />
        <div className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
          {!showCc && (
            <button type="button" onClick={() => setShowCc(true)} className="hover:text-foreground">Cc</button>
          )}
          {!showBcc && (
            <button type="button" onClick={() => setShowBcc(true)} className="hover:text-foreground">Bcc</button>
          )}
        </div>
      </div>

      {showCc && (
        <div className="flex items-center border-b px-4 py-1.5 text-sm">
          <span className="w-12 shrink-0 text-muted-foreground">Cc</span>
          <input
            type="text"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            className="flex-1 bg-transparent outline-none"
          />
        </div>
      )}

      {showBcc && (
        <div className="flex items-center border-b px-4 py-1.5 text-sm">
          <span className="w-12 shrink-0 text-muted-foreground">Bcc</span>
          <input
            type="text"
            value={bcc}
            onChange={(e) => setBcc(e.target.value)}
            className="flex-1 bg-transparent outline-none"
          />
        </div>
      )}

      <div className="border-b px-4 py-1.5 text-sm">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full bg-transparent outline-none"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <RichTextEditor
          value={body}
          onChange={setBody}
          placeholder=""
          minHeight={expanded ? 400 : 200}
          autoFocus
          className="flex-1"
        />
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t px-4 py-2">
          {attachments.map((file, i) => (
            <div key={`${file.name}-${i}`} className="flex items-center gap-2 rounded border bg-muted/30 px-2 py-1 text-xs">
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[150px] truncate">{file.name}</span>
              <span className="text-muted-foreground">{(file.size / 1024).toFixed(0)}KB</span>
              <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-b-lg border-t bg-card px-4 py-2">
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send"}
        </button>
        <label className="cursor-pointer rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Attach files">
          <Paperclip className="h-4 w-4" />
          <input type="file" multiple className="hidden" onChange={(e) => {
            const files = e.target.files
            if (!files) return
            setAttachments((prev) => [...prev, ...Array.from(files)])
            e.target.value = ""
          }} />
        </label>
        <div className="ml-auto">
          <button
            onClick={() => { setAttachments([]); onClose() }}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Discard"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
