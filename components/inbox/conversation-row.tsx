"use client"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Star, Trash2 } from "lucide-react"
import { type ThreadWithBuyer } from "@/services/message-service"
import { supabase } from "@/lib/supabase"
import { useQueryClient } from "@tanstack/react-query"
import useFreshnessTimer from "@/hooks/use-freshness-timer"
import { formatSmartTimestamp } from "@/utils/date"

interface ConversationRowProps {
  thread: ThreadWithBuyer
  selected?: boolean
  onSelect?: (thread: ThreadWithBuyer) => void
}

export default function ConversationRow({ thread, selected, onSelect }: ConversationRowProps) {
  const isFresh = useFreshnessTimer(new Date(thread.updated_at))
  let queryClient: ReturnType<typeof useQueryClient> | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    queryClient = useQueryClient()
  } catch {
    queryClient = null
  }
  const buyer = thread.buyers
  const name = buyer
    ? buyer.full_name || `${buyer.fname || ""} ${buyer.lname || ""}`.trim() || "Unnamed"
    : thread.phone_number

  const color = !thread.unread
    ? "bg-gray-400"
    : isFresh
    ? "bg-blue-500"
    : "bg-red-500"

  const timestamp = formatSmartTimestamp(thread.updated_at)

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const toggleStar = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await supabase
      .from("message_threads")
      .update({ starred: !thread.starred })
      .eq("id", thread.id)
    queryClient?.invalidateQueries({ queryKey: ["message-threads"] })
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ts = new Date().toISOString()
    await supabase.from("messages").update({ deleted_at: ts }).eq("thread_id", thread.id)
    await supabase.from("message_threads").update({ deleted_at: ts }).eq("id", thread.id)
    queryClient?.invalidateQueries({ queryKey: ["message-threads"] })
  }

  return (
    <div
      className={cn(
        "p-2 cursor-pointer border-b flex items-center gap-2 group hover:border-primary border-l-2 border-transparent",
        selected && "bg-muted",
      )}
      onClick={() => onSelect?.(thread)}
    >
      <span className={cn("h-2 w-2 rounded-full", color)} />
      <Avatar className="h-8 w-8">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="font-medium text-sm truncate flex-1">{name}</div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {timestamp}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
            <button type="button" onClick={toggleStar} className="text-muted-foreground">
              <Star
                className={cn(
                  "h-4 w-4",
                  thread.starred ? "fill-yellow-400 text-yellow-400" : "",
                )}
              />
            </button>
            <button type="button" onClick={handleDelete} className="text-muted-foreground">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {thread.last_message || thread.phone_number}
        </div>
      </div>
    </div>
  )
}
