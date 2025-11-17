"use client"

import { useEffect, useRef, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Archive,
  Trash2,
  MailOpen,
  Mail,
  ChevronLeft,
  ChevronRight,
  Star,
  StarOff,
  MoreVertical,
  Folder,
  Tag,
  BellOff,
  Inbox,
  Paperclip,
  X,
  type LucideIcon,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatSmartTimestamp } from "@/utils/date"

/**
 * ------------------------------------------------------------
 *  Gmail – ListPane
 *  -----------------------------------------------------------
 *  – Shows one page of Gmail threads, Gmail‑style.
 *  – Never assume headers exist; fallback aggressively.
 *  – Sender, subject, preview, timestamp (time today, date otherwise).
 *  – Unread ⇒ bold + blue dot. Hover ⇒ row actions.
 *  – Bulk‑actions toolbar appears when any rows selected.
 *  – Keeps *all* earlier logic (star, archive, delete, etc.).
 * ------------------------------------------------------------
 */

interface GmailMessage {
  id: string
  snippet?: string
  payload?: {
    headers?: { name: string; value: string }[]
    parts?: { filename?: string; body?: { attachmentId?: string } }[]
  }
  labelIds?: string[]
}

interface GmailThread {
  id: string
  messages?: GmailMessage[]
  snippet?: string
  unread?: boolean
  starred?: boolean
}

interface ListPaneProps {
  threads: GmailThread[]
  isLoading: boolean
  error?: unknown
  search: string
  onSelect: (id: string) => void
  selectedId?: string
}

/** Get *raw* header. */
function getHeader(msg: GmailMessage | undefined, name: string) {
  return (
    msg?.payload?.headers?.find(
      (h) => h.name.toLowerCase() === name.toLowerCase(),
    )?.value || ""
  )
}

/** Extract display‑name from From header. */
function extractSender(fromRaw: string) {
  if (!fromRaw) return "(No sender)"
  // "Google <noreply@google.com>"  OR  "\"John Doe\" <john@doe.com>"
  const match = fromRaw.match(/^(?:\"?([^<\"]+)\"?)?\s*<([^>]+)>$/)
  if (match) {
    return match[1]?.trim() || match[2]
  }
  return fromRaw
}

const PER_PAGE = 50

export default function ListPane({
  threads,
  isLoading,
  error,
  search,
  onSelect,
  selectedId,
}: ListPaneProps) {
  /** --------------------------------------------- state + helpers */
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [starred, setStarred] = useState<Record<string, boolean>>({})
  const [showError, setShowError] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const savedScroll = useRef<number | null>(null)

  const preserveScroll = (fn: () => void) => {
    if (listRef.current) savedScroll.current = listRef.current.scrollTop
    fn()
  }
  useEffect(() => {
    if (listRef.current && savedScroll.current !== null) {
      listRef.current.scrollTop = savedScroll.current
      savedScroll.current = null
    }
  }, [selected])

  /** --------------------------------------------- filter / pagination */
  const parseDate = (msg: GmailMessage | undefined) => {
    const stamp = Date.parse(getHeader(msg, "date"))
    return Number.isNaN(stamp) ? 0 : stamp
  }

  const sorted = [...threads].sort((a, b) => {
    const aMsg = a.messages?.[a.messages.length - 1]
    const bMsg = b.messages?.[b.messages.length - 1]
    return parseDate(bMsg) - parseDate(aMsg)
  })

  const filtered = sorted.filter((t) => {
    const msg = t.messages?.[t.messages.length - 1]
    const term = search.toLowerCase()
    return (
      extractSender(getHeader(msg, "from")).toLowerCase().includes(term) ||
      getHeader(msg, "subject").toLowerCase().includes(term) ||
      (t.snippet || msg?.snippet || "").toLowerCase().includes(term)
    )
  })

  const total = filtered.length
  const start = page * PER_PAGE
  const pageThreads = filtered.slice(start, start + PER_PAGE)

  /** --------------------------------------------- bulk‑selection logic */
  const numSelected = Object.values(selected).filter(Boolean).length
  const pageSelectedCount = pageThreads.filter((t) => selected[t.id]).length
  const allSelected = pageThreads.length > 0 && pageSelectedCount === pageThreads.length
  const partiallySelected = pageSelectedCount > 0 && !allSelected
  const selectAllState: boolean | "indeterminate" = allSelected ? true : partiallySelected ? "indeterminate" : false

  const toggle = (id: string) => preserveScroll(() => setSelected((s) => ({ ...s, [id]: !s[id] })))
  const toggleAll = () => preserveScroll(() => {
    const draft = { ...selected }
    const value = !allSelected
    pageThreads.forEach((t) => (draft[t.id] = value))
    setSelected(draft)
  })

  /** --------------------------------------------- helpers that hit API */
  const bulk = async (url: string, body: Record<string, unknown>) => {
    const ids = Object.keys(selected).filter((id) => selected[id])
    await Promise.all(ids.map((id) => fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, threadId: id }),
    })))
    setSelected({})
  }

  /** --------------------------------------------- ui */
  return (
    <div className="flex h-full flex-col border-r">
      {/* error banner */}
      {error && showError && (
        <Alert variant="destructive" className="m-2 flex justify-between">
          <div>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {(error as Error).message || "Failed to load emails"}
            </AlertDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowError(false)}>
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      )}

      {/* bulk‑toolbar */}
      <div className="flex items-center border-b p-2 gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <Checkbox checked={selectAllState} onCheckedChange={toggleAll} aria-label="Select all" />
        {numSelected > 0 && (
          <TooltipProvider>
            {([
              [Archive, "Archive", () => bulk("/api/gmail/archive", {})],
              [Trash2, "Delete", () => bulk("/api/gmail/delete", {})],
              [MailOpen, "Mark read", () => bulk("/api/gmail/unread", { unread: false })],
              [Mail, "Mark unread", () => bulk("/api/gmail/unread", { unread: true })],
              [Star, "Star", () => bulk("/api/gmail/star", { starred: true })],
              [StarOff, "Unstar", () => bulk("/api/gmail/star", { starred: false })],
              [BellOff, "Mute", undefined],
              [Folder, "Move", undefined],
              [Tag, "Label", undefined],
            ] as [LucideIcon, string, (() => void) | undefined][]).map(([Icon, label, act]) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={act} disabled={!act}>
                    <Icon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        )}
        <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
          <Button variant="ghost" size="icon" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span>
            {start + 1}-{Math.min(start + PER_PAGE, total)} of {total}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setPage((p) => (start + PER_PAGE < total ? p + 1 : p))} disabled={start + PER_PAGE >= total}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* list */}
      <div ref={listRef} className="flex-1 overflow-y-auto divide-y">
        {isLoading && [...Array(10)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <p>No emails found</p>
          </div>
        )}

        {!isLoading && pageThreads.map((t) => {
          if (!t.id) return null
          const msg = t.messages?.[t.messages.length - 1]
          const sender = extractSender(getHeader(msg, "from"))
          const subject = getHeader(msg, "subject")
          const preview = (msg?.snippet || t.snippet || "").slice(0, 120)
          const dateRaw = getHeader(msg, "date")
          const stamp = formatSmartTimestamp(dateRaw)
          const unread = typeof t.unread === "boolean" ? t.unread : (msg as any)?.labelIds?.includes("UNREAD")
          const isStarred = starred[t.id] ?? t.starred ?? false
          const count = t.messages?.length ?? 0
          const hasAttach = t.messages?.some((m) =>
            m.payload?.parts?.some((p) => p.filename && p.body?.attachmentId),
          )

          return (
            <div
              key={t.id}
              data-testid="thread-row"
              className={cn(
                "group flex items-center gap-2 px-4 py-2 hover:bg-muted",
                selectedId === t.id && "bg-muted",
              )}
            >
              <Checkbox
                checked={!!selected[t.id]}
                onCheckedChange={() => toggle(t.id)}
                onClick={(e) => e.stopPropagation()}
                className="mr-1 shrink-0"
              />
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  const next = !isStarred
                  setStarred((s) => ({ ...s, [t.id]: next }))
                  await fetch("/api/gmail/star", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ threadId: t.id, starred: next }),
                  })
                }}
                className="shrink-0"
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground",
                  )}
                />
              </button>
              {unread && <span className="ml-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(t.id)}
                className="min-w-0 flex-1 grid grid-cols-[12rem_auto_1fr_auto] items-baseline gap-x-4 text-left"
              >
                <span className={cn("truncate", unread && "font-semibold")}>{sender}
                  {count > 1 && <span className="text-xs text-muted-foreground"> ({count})</span>}
                </span>
                <span className={cn("truncate", unread && "font-semibold")}>{subject}</span>
                <span className="truncate text-muted-foreground">
                  {" - "}
                  {preview}
                  {hasAttach && <Paperclip className="ml-1 inline-block h-3 w-3" />}
                </span>
                <span className="justify-self-end whitespace-nowrap text-xs text-muted-foreground">{stamp}</span>
              </button>
              {/* hover row actions */}
              <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    fetch("/api/gmail/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: t.id }) })
                  }}
                >
                  <Archive className="h-4 w-4 text-muted-foreground" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    fetch("/api/gmail/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: t.id }) })
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button>
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Mute</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
