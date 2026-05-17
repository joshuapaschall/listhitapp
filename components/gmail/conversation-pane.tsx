"use client"

import { useEffect, useMemo, useState } from "react"
import DOMPurify from "dompurify"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { decodeMessage, GmailMessage } from "@/lib/gmail-utils"
import { Button } from "@/components/ui/button"
import RichTextEditor from "./rich-text-editor"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Archive, ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Forward, Inbox, Loader2, MoreVertical, Printer, Reply, ReplyAll, Star, Tag, Trash2, Clock3, OctagonAlert, MailOpen, Paperclip, X } from "lucide-react"

interface GmailLabel { id: string; name: string; color?: { backgroundColor?: string; textColor?: string } }
interface LabelsResponse { system: GmailLabel[]; categories: GmailLabel[]; user: GmailLabel[] }
interface GmailThread { id: string; messages?: GmailMessage[]; unread?: boolean }
interface ConversationPaneProps { threadId: string | null; onBack?: () => void; onPrev?: () => void; onNext?: () => void }
type ReplyMode = "reply" | "reply-all" | "forward" | null

function getHeader(msg: GmailMessage | undefined, name: string): string {
  return msg?.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ""
}
function parseDisplayName(raw: string): string {
  const m = raw.match(/^(.*?)\s*<[^>]+>$/)
  return (m?.[1] || raw || "Unknown").replace(/^"|"$/g, "").trim()
}
function parseEmail(raw: string): string {
  const m = raw.match(/<([^>]+)>/)
  return (m?.[1] || raw).trim()
}
function formatMessageDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value || ""
  const now = new Date()
  const opts: Intl.DateTimeFormatOptions = d.getFullYear() === now.getFullYear() ? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
  return new Intl.DateTimeFormat("en-US", opts).format(d)
}
function getInitials(name: string, email: string): string {
  const clean = name.trim()
  if (clean && clean !== "Unknown") return clean.split(/\s+/)[0].slice(0, 1).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}
function getAvatarColor(email: string): string {
  const colors = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500", "bg-rose-500", "bg-cyan-500"]
  const hash = email.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export default function ConversationPane({ threadId, onBack, onPrev, onNext }: ConversationPaneProps) {
  const queryClient = useQueryClient()
  const [reply, setReply] = useState("")
  const [forwardTo, setForwardTo] = useState("")
  const [replyMode, setReplyMode] = useState<ReplyMode>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const [showAllMessages, setShowAllMessages] = useState(false)
  const [expandedMessageDetails, setExpandedMessageDetails] = useState<Set<string>>(new Set())
  const [pendingArchive, setPendingArchive] = useState(false)

  const { data, error, isLoading } = useQuery<GmailThread>({
    queryKey: ["gmail-thread", threadId],
    enabled: Boolean(threadId),
    queryFn: async () => {
      const res = await fetch(`/api/gmail/threads/${threadId}`)
      if (!res.ok) throw new Error("Failed to load thread")
      const json = await res.json()
      return json.thread as GmailThread
    },
  })

  const { data: labelData } = useQuery<LabelsResponse>({
    queryKey: ["gmail-labels"],
    queryFn: async () => {
      const res = await fetch("/api/gmail/labels")
      if (!res.ok) throw new Error("Failed labels")
      return res.json()
    },
    enabled: Boolean(threadId),
  })

  useEffect(() => { setShowAllMessages(false); setReplyMode(null); setReply(""); setAttachments([]); setExpandedMessageDetails(new Set()) }, [threadId])

  useEffect(() => {
    if (data?.id && data.unread) {
      fetch("/api/gmail/unread", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: data.id, unread: false }) })
        .then(() => queryClient.invalidateQueries({ queryKey: ["gmail-threads"] }))
    }
  }, [data?.id, data?.unread, queryClient])

  const messages = useMemo(() => data?.messages || [], [data?.messages])
  const visibleMessages = useMemo(() => {
    if (showAllMessages || messages.length <= 3) return messages
    return [messages[0], messages[messages.length - 1]].filter(Boolean) as GmailMessage[]
  }, [messages, showAllMessages])

  const allLabels = useMemo(() => [...(labelData?.system || []), ...(labelData?.categories || []), ...(labelData?.user || [])], [labelData])
  const threadLabels = useMemo(() => {
    const ids = new Set<string>()
    const hidden = new Set(["UNREAD", "INBOX", "IMPORTANT", "STARRED"])
    messages.forEach((m) => ((m as GmailMessage & { labelIds?: string[] }).labelIds || []).forEach((id) => { if (!hidden.has(id) && !id.startsWith("CATEGORY_")) ids.add(id) }))
    return Array.from(ids).map((id) => allLabels.find((l) => l.id === id)).filter(Boolean) as GmailLabel[]
  }, [messages, allLabels])

  const threadSubject = getHeader(messages[messages.length - 1], "subject")

  async function handleAction(url: string, body?: Record<string, unknown>) {
    if (!threadId) return
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId, ...(body || {}) }) })
    if (!res.ok) throw new Error("Action failed")
    await queryClient.invalidateQueries({ queryKey: ["gmail-threads"] })
    await queryClient.invalidateQueries({ queryKey: ["gmail-thread", threadId] })
    await queryClient.invalidateQueries({ queryKey: ["gmail-labels"] })
  }

  async function handleSend() {
    if (!threadId || !reply.trim() || messages.length === 0 || !replyMode) return
    const last = messages[messages.length - 1]
    const to = replyMode === "forward" ? forwardTo.trim() : getHeader(last, "from")
    if (!to) return toast.error("Recipient is required")
    const subject = getHeader(last, "subject")
    const isForward = replyMode === "forward"
    const endpoint = isForward ? "/api/gmail/send" : "/api/gmail/reply"
    const totalSize = attachments.reduce((sum, file) => sum + file.size, 0) + reply.length
    if (totalSize > 5 * 1024 * 1024) {
      toast.error("Message size exceeds 5MB. Reduce attachment size.")
      return
    }

    let finalBody = reply
    if (isForward) {
      const lastFrom = getHeader(last, "from")
      const lastDate = getHeader(last, "date")
      const decoded = decodeMessage(last)
      const lastBodyHtml = decoded.html || decoded.text || ""
      const quote = `<br><br><div class="gmail_quote" style="border-left:2px solid #ccc; padding-left:8px; color:#555;"><p>---------- Forwarded message ----------<br>From: ${lastFrom}<br>Date: ${lastDate}<br>Subject: ${subject}</p>${lastBodyHtml}</div>`
      finalBody = reply + quote
    }

    const formData = new FormData()
    if (!isForward) formData.append("threadId", threadId)
    formData.append("to", to)
    formData.append("subject", isForward ? `Fwd: ${subject || "(No subject)"}` : subject)
    formData.append("html", finalBody)
    attachments.forEach((file) => formData.append("attachments", file))

    try {
      const res = await fetch(endpoint, { method: "POST", body: formData })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || "Failed to send")
      }
      setReply("")
      setForwardTo("")
      setAttachments([])
      setReplyMode(null)
      await queryClient.invalidateQueries({ queryKey: ["gmail-threads"] })
      await queryClient.invalidateQueries({ queryKey: ["gmail-thread", threadId] })
      toast.success(isForward ? "Forwarded" : "Reply sent")
      if (pendingArchive && threadId) {
        try {
          await fetch("/api/gmail/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId }) })
          await queryClient.invalidateQueries({ queryKey: ["gmail-threads"] })
          if (onBack) onBack()
        } catch (e) {
          console.error("Archive after send failed", e)
        }
      }
      setPendingArchive(false)
    } catch (e) {
      setPendingArchive(false)
      toast.error((e as Error).message)
    }
  }


  if (!threadId) return <div className="p-4">Select a thread</div>
  if (isLoading) return <div className="flex h-full items-center justify-center p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
  if (error) return <div className="p-4 text-destructive">Failed to load thread</div>

  return <div className="flex h-full flex-col">
    <div className="flex h-12 items-center justify-between border-b px-2">
      <div className="flex items-center gap-1">
        {onBack && <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>}
        <div className="mx-1 h-5 w-px bg-border" />
        <Button variant="ghost" size="icon" onClick={() => handleAction("/api/gmail/archive").catch((e) => toast.error((e as Error).message))}><Archive className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => toast.message("Report spam coming soon") }><OctagonAlert className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => handleAction("/api/gmail/delete").catch((e) => toast.error((e as Error).message))}><Trash2 className="h-4 w-4" /></Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button variant="ghost" size="icon" onClick={() => handleAction("/api/gmail/unread", { unread: true }).catch((e) => toast.error((e as Error).message))}><MailOpen className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon"><Clock3 className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon"><Inbox className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon"><Tag className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
      </div>
      <div className="flex items-center gap-1">
        {onPrev && <Button variant="ghost" size="icon" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>}
        {onNext && <Button variant="ghost" size="icon" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>}
      </div>
    </div>

    <div className="border-b px-6 py-4">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium leading-tight">{threadSubject || "(No subject)"}</h1>
        <button className="mt-1 shrink-0 text-xs text-muted-foreground hover:text-foreground"><Printer className="h-4 w-4" /></button>
      </div>
      {threadLabels.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{threadLabels.map((label) => <span key={label.id} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs" style={label.color?.backgroundColor ? { borderColor: label.color.backgroundColor } : undefined}>{label.name}</span>)}</div>}
    </div>

    <div className="flex-1 overflow-y-auto">
      {visibleMessages.map((msg) => {
        const fromHeader = getHeader(msg, "from")
        const fromName = parseDisplayName(fromHeader)
        const fromEmail = parseEmail(fromHeader)
        const dateStr = formatMessageDate(getHeader(msg, "date"))
        const decoded = decodeMessage(msg)
        return <div key={msg.id} className="border-b px-6 py-4 last:border-none">
          <div className="flex items-start gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white", getAvatarColor(fromEmail))}>{getInitials(fromName, fromEmail)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2"><p className="text-sm font-semibold">{fromName}</p><p className="text-xs text-muted-foreground">&lt;{fromEmail}&gt;</p></div>
              <button onClick={() => setExpandedMessageDetails((prev) => { const next = new Set(prev); if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id); return next })} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">to me <ChevronDown className="h-3 w-3" /></button>
            </div>
            <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">{dateStr}</span><button className="rounded p-1 hover:bg-muted" title="Star"><Star className="h-4 w-4" /></button><button className="rounded p-1 hover:bg-muted" title="Reply" onClick={() => setReplyMode("reply")}><Reply className="h-4 w-4" /></button><button className="rounded p-1 hover:bg-muted" title="More"><MoreVertical className="h-4 w-4" /></button></div>
          </div>
          {expandedMessageDetails.has(msg.id) && <div className="ml-[52px] mt-2 space-y-1 rounded border bg-muted/30 p-3 text-xs"><div><span className="font-medium">From:</span> {getHeader(msg, "from")}</div><div><span className="font-medium">To:</span> {getHeader(msg, "to")}</div>{getHeader(msg, "cc") && <div><span className="font-medium">Cc:</span> {getHeader(msg, "cc")}</div>}<div><span className="font-medium">Date:</span> {getHeader(msg, "date")}</div><div><span className="font-medium">Subject:</span> {getHeader(msg, "subject")}</div></div>}
          <div className="ml-[52px] mt-3 text-sm">{decoded.html ? <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(decoded.html) }} /> : <div className="whitespace-pre-wrap">{decoded.text}</div>}</div>
        </div>
      })}

      {messages.length > 3 && !showAllMessages && <button onClick={() => setShowAllMessages(true)} className="my-2 flex w-full items-center gap-3 rounded-lg border border-dashed px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50"><div className="h-px flex-1 bg-border" /><span>{messages.length - 2} earlier messages</span><div className="h-px flex-1 bg-border" /></button>}
    </div>

    {replyMode === null ? (
      <div className="flex items-center gap-2 px-6 py-3">
        <button onClick={() => setReplyMode("reply")} className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm hover:bg-muted"><Reply className="h-4 w-4" />Reply</button>
        <button onClick={() => setReplyMode("reply-all")} className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm hover:bg-muted"><ReplyAll className="h-4 w-4" />Reply all</button>
        <button onClick={() => setReplyMode("forward")} className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm hover:bg-muted"><Forward className="h-4 w-4" />Forward</button>
      </div>
    ) : (
      <div className="space-y-2 border-t p-3">
        {replyMode === "forward" && <input value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} placeholder="Recipient email" className="w-full rounded-md border px-3 py-2 text-sm" />}
        <div className="rounded-md border"><RichTextEditor value={reply} onChange={setReply} placeholder={replyMode === "forward" ? "Add a message..." : "Type your reply..."} minHeight={120} autoFocus /></div>
        {attachments.length > 0 && <div className="flex flex-wrap gap-2">{attachments.map((file, i) => <div key={`${file.name}-${i}`} className="flex items-center gap-2 rounded border bg-muted/30 px-2 py-1 text-xs"><Paperclip className="h-3 w-3" /><span className="max-w-[150px] truncate">{file.name}</span><button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button></div>)}</div>}
        <div className="flex items-center gap-2"><Button size="sm" onClick={handleSend} disabled={!reply.trim()}>Send</Button><Button size="sm" variant="outline" onClick={() => { setPendingArchive(true); handleSend() }} disabled={!reply.trim()}>Send & archive</Button><label className="cursor-pointer rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Attach files"><Paperclip className="h-4 w-4" /><input type="file" multiple className="hidden" onChange={(e) => { const files = e.target.files; if (!files) return; setAttachments((prev) => [...prev, ...Array.from(files)]); e.target.value = "" }} /></label><Button size="sm" variant="ghost" onClick={() => { setReplyMode(null); setReply(""); setAttachments([]) }}>Cancel</Button></div>
      </div>
    )}
  </div>
}
