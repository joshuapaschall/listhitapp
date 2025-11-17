"use client"

import { useState, useEffect } from "react"
import DOMPurify from "dompurify"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { decodeMessage, GmailMessage } from "@/lib/gmail-utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  ArrowLeft,
  Archive,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Loader2,
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

// GmailMessage interface imported from lib

interface GmailThread {
  id: string
  messages?: GmailMessage[]
  unread?: boolean
}

interface ConversationPaneProps {
  threadId: string | null
  onBack?: () => void
  onPrev?: () => void
  onNext?: () => void
}

function getHeader(msg: GmailMessage | undefined, name: string) {
  return (
    msg?.payload?.headers?.find(
      (h) => h.name.toLowerCase() === name.toLowerCase(),
    )?.value || ""
  )
}

export default function ConversationPane({ threadId, onBack, onPrev, onNext }: ConversationPaneProps) {
  const queryClient = useQueryClient()

  const { data, error, isLoading } = useQuery({
    queryKey: ["gmail-thread", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const res = await fetch(`/api/gmail/threads/${threadId}`)
      if (!res.ok) throw new Error("Failed to load thread")
      const json = await res.json()
      return json.thread as GmailThread
    },
  })

  useEffect(() => {
    if (data?.id && data.unread) {
      fetch("/api/gmail/unread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: data.id, unread: false }),
      }).then(() =>
        queryClient.invalidateQueries({ queryKey: ["gmail-threads"] }),
      )
    }
  }, [data?.id, data?.unread, queryClient])

  const [reply, setReply] = useState("")

  if (!threadId) {
    return <div className="p-4">Select a thread</div>
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }

  if (error) {
    return <div className="p-4 text-destructive">Failed to load thread</div>
  }

  const messages = data?.messages || []

  const handleSend = async () => {
    if (!threadId || !reply.trim() || !messages.length) return
    const last = messages[messages.length - 1]
    const to = getHeader(last, "from")
    const subject = getHeader(last, "subject")
    try {
      const res = await fetch("/api/gmail/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, to, subject, text: reply.trim() }),
      })
      if (!res.ok) throw new Error("Failed to send reply")
      setReply("")
      queryClient.invalidateQueries({ queryKey: ["gmail-threads"] })
      queryClient.invalidateQueries({ queryKey: ["gmail-thread", threadId] })
    } catch (err) {
      console.error("Failed to send reply", err)
      toast.error((err as Error).message)
    }
  }

  const handleAction = async (url: string) => {
    if (!threadId) return
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      })
      if (!res.ok) throw new Error("Action failed")
      queryClient.invalidateQueries({ queryKey: ["gmail-threads"] })
      queryClient.invalidateQueries({ queryKey: ["gmail-thread", threadId] })
    } catch (err) {
      console.error("Action failed", err)
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center justify-between border-b px-2">
        <div className="flex items-center gap-2">
          {onBack && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Back</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            {[
              [Archive, "Archive", "/api/gmail/archive"],
              [Trash2, "Delete", "/api/gmail/delete"],
            ].map(([Icon, label, url]) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleAction(url as string)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-1">
          {onPrev && (
            <Button variant="ghost" size="icon" onClick={onPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {onNext && (
            <Button variant="ghost" size="icon" onClick={onNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem>Reply</DropdownMenuItem>
              <DropdownMenuItem>Reply to All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction("/api/gmail/delete")}>Delete</DropdownMenuItem>
              <DropdownMenuItem>Block</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => {
          const from = getHeader(m, "from")
          const subject = getHeader(m, "subject")
          const date = getHeader(m, "date")
          const decoded = decodeMessage(m)
          return (
            <div key={m.id} className="border-b pb-4 last:border-none">
              <div className="flex justify-between">
                <div className="text-sm font-medium">{from}</div>
                <div className="text-xs text-muted-foreground">{date}</div>
              </div>
              <div className="text-xs text-muted-foreground mb-2">{subject}</div>
              {decoded.html ? (
                <div
                  className="prose max-w-none text-sm"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(decoded.html),
                  }}
                />
              ) : (
                <div className="whitespace-pre-wrap text-sm">{decoded.text}</div>
              )}
            </div>
          )
        })}
      </div>
      <div className="border-t p-2 space-y-2">
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={3}
        />
        <div>
          <Button size="sm" onClick={handleSend} disabled={!reply.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
