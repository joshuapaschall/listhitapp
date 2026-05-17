"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatSmartTimestamp } from "@/utils/date"
import { toast } from "sonner"
import { Archive, Clock, Inbox, Mail, MailOpen, Paperclip, Star, Trash2, X } from "lucide-react"

interface GmailMessageHeader { name?: string; value?: string }
interface GmailMessagePart { filename?: string; body?: { attachmentId?: string } }
interface GmailMessage {
  id: string
  snippet?: string
  payload?: { headers?: GmailMessageHeader[]; parts?: GmailMessagePart[] }
  labelIds?: string[]
}
interface GmailThread { id: string; messages?: GmailMessage[]; snippet?: string; unread?: boolean; starred?: boolean }
interface ListPaneProps { threads: GmailThread[]; isLoading: boolean; error?: unknown; search: string; onSelect: (id: string) => void; selectedId?: string }

function getHeader(msg: GmailMessage | undefined, name: string): string {
  return msg?.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ""
}
function extractSender(fromRaw: string): string {
  if (!fromRaw) return "(No sender)"
  const match = fromRaw.match(/^(?:\"?([^<\"]+)\"?)?\s*<([^>]+)>$/)
  if (match) return match[1]?.trim() || match[2]
  return fromRaw
}

export default function ListPane({ threads, isLoading, error, search, onSelect, selectedId }: ListPaneProps) {
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({})
  const [showError, setShowError] = useState(true)

  const filtered = useMemo(() => {
    const sorted = [...threads].sort((a, b) => {
      const aMsg = a.messages?.[a.messages.length - 1]
      const bMsg = b.messages?.[b.messages.length - 1]
      const aTs = Date.parse(getHeader(aMsg, "date"))
      const bTs = Date.parse(getHeader(bMsg, "date"))
      return (Number.isNaN(bTs) ? 0 : bTs) - (Number.isNaN(aTs) ? 0 : aTs)
    })
    const term = search.toLowerCase()
    return sorted.filter((t) => {
      const msg = t.messages?.[t.messages.length - 1]
      return (
        extractSender(getHeader(msg, "from")).toLowerCase().includes(term) ||
        getHeader(msg, "subject").toLowerCase().includes(term) ||
        (t.snippet || msg?.snippet || "").toLowerCase().includes(term)
      )
    })
  }, [threads, search])

  const allSelected = filtered.length > 0 && filtered.every((t) => selectedIds.includes(t.id))

  async function postAction(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      throw new Error(json?.error || "Action failed")
    }
    await queryClient.invalidateQueries({ queryKey: ["gmail-threads"] })
    await queryClient.invalidateQueries({ queryKey: ["gmail-labels"] })
  }

  const handleArchive = (threadId: string) => postAction("/api/gmail/archive", { threadId }).catch((e) => toast.error((e as Error).message))
  const handleDelete = (threadId: string) => postAction("/api/gmail/delete", { threadId }).catch((e) => toast.error((e as Error).message))
  const handleToggleRead = (threadId: string, currentUnread: boolean) =>
    postAction("/api/gmail/unread", { threadId, unread: !currentUnread }).catch((e) => toast.error((e as Error).message))

  async function handleBulk(url: string, extraBody?: Record<string, unknown>) {
    const ids = [...selectedIds]
    try {
      await Promise.all(ids.map((threadId) => postAction(url, { threadId, ...(extraBody || {}) })))
      setSelectedIds([])
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col border-r">
      {Boolean(error) && showError && (
        <Alert variant="destructive" className="m-2 flex justify-between">
          <div>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{(error as Error).message || "Failed to load emails"}</AlertDescription>
          </div>
          <button onClick={() => setShowError(false)} className="rounded p-1 hover:bg-destructive/20" aria-label="Dismiss error">
            <X className="h-4 w-4" />
          </button>
        </Alert>
      )}

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-1 border-b bg-muted/30 px-4 py-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => {
              if (checked) setSelectedIds(filtered.map((t) => t.id))
              else setSelectedIds([])
            }}
          />
          <span className="ml-2 text-sm text-muted-foreground">{selectedIds.length} selected</span>
          <div className="ml-4 flex items-center gap-1">
            <button onClick={() => handleBulk("/api/gmail/archive")} className="rounded-full p-2 hover:bg-muted" title="Archive"><Archive className="h-4 w-4" /></button>
            <button onClick={() => handleBulk("/api/gmail/delete")} className="rounded-full p-2 hover:bg-muted" title="Delete"><Trash2 className="h-4 w-4" /></button>
            <button onClick={() => handleBulk("/api/gmail/unread", { unread: false })} className="rounded-full p-2 hover:bg-muted" title="Mark as read"><MailOpen className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 border-b px-4 py-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <Inbox className="mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm font-medium">No conversations</p>
            <p className="mt-1 text-xs text-muted-foreground">Nothing here yet. New mail will show up automatically.</p>
          </div>
        )}

        {!isLoading && filtered.map((t) => {
          const msg = t.messages?.[t.messages.length - 1]
          const sender = extractSender(getHeader(msg, "from"))
          const subject = getHeader(msg, "subject") || "(No subject)"
          const snippet = (msg?.snippet || t.snippet || "").slice(0, 140)
          const smartTimestamp = formatSmartTimestamp(getHeader(msg, "date"))
          const unread = typeof t.unread === "boolean" ? t.unread : Boolean(msg?.labelIds?.includes("UNREAD"))
          const isSelected = selectedIds.includes(t.id)
          const isStarred = starredMap[t.id] ?? Boolean(t.starred)
          const hasAttach = Boolean(t.messages?.some((m) => m.payload?.parts?.some((p) => Boolean(p.filename && p.body?.attachmentId))))

          return (
            <div key={t.id} className={cn("group flex items-center gap-2 border-b px-4 py-2 hover:bg-muted/50", unread && "bg-primary/[0.02]", selectedId === t.id && "bg-muted") }>
              <Checkbox checked={isSelected} onCheckedChange={(checked) => setSelectedIds((prev) => checked ? Array.from(new Set([...prev, t.id])) : prev.filter((id) => id !== t.id))} />
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  const next = !isStarred
                  setStarredMap((s) => ({ ...s, [t.id]: next }))
                  try { await postAction("/api/gmail/star", { threadId: t.id, starred: next }) } catch (err) { toast.error((err as Error).message) }
                }}
                className="shrink-0"
              >
                <Star className={cn("h-4 w-4", isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
              </button>
              <button onClick={() => onSelect(t.id)} className="flex min-w-0 flex-1 items-baseline gap-3 text-left">
                <span className={cn("truncate text-sm", unread && "font-semibold")}>{sender}</span>
                <div className="min-w-0 truncate text-sm">
                  <span className={cn(unread && "font-semibold")}>{subject}</span>
                  <span className="mx-1.5 text-muted-foreground">—</span>
                  <span className="text-muted-foreground">{snippet}</span>
                </div>
                {hasAttach && <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </button>
              <div className="ml-auto flex items-center gap-1">
                <span className={cn("text-xs text-muted-foreground", !isSelected && "group-hover:hidden")}>{smartTimestamp}</span>
                {!isSelected && (
                  <div className="hidden items-center gap-1 group-hover:flex">
                    <button onClick={(e) => { e.stopPropagation(); handleArchive(t.id) }} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Archive"><Archive className="h-3.5 w-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleToggleRead(t.id, unread) }} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title={unread ? "Mark as read" : "Mark as unread"}>{unread ? <MailOpen className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}</button>
                    <button onClick={(e) => e.stopPropagation()} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Snooze"><Clock className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
