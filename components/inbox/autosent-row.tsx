"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { type AutosentMessage, type ThreadWithBuyer } from "@/services/message-service"
import { cn } from "@/lib/utils"
import { formatSmartTimestamp } from "@/utils/date"

interface AutosentRowProps {
  message: AutosentMessage
  selected?: boolean
  onSelect?: (thread: ThreadWithBuyer) => void
}

export default function AutosentRow({ message, selected, onSelect }: AutosentRowProps) {
  const buyer = message.buyers
  const name = buyer
    ? buyer.full_name || `${buyer.fname || ""} ${buyer.lname || ""}`.trim() || "Unnamed"
    : message.message_threads?.phone_number || ""
  const timestamp = formatSmartTimestamp(message.created_at)
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const handleClick = () => {
    const thread = message.message_threads
    if (!thread) return
    const threadWithBuyer: ThreadWithBuyer = {
      ...thread,
      buyers: message.buyers ?? null,
      last_message: message.body ?? null,
    }
    onSelect?.(threadWithBuyer)
  }

  return (
    <div
      className={cn(
        "p-2 cursor-pointer border-b flex items-center gap-2 hover:bg-muted",
        selected && "bg-muted"
      )}
      onClick={handleClick}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="font-medium text-sm truncate flex-1">{name}</div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">{timestamp}</div>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {message.body || message.message_threads?.phone_number}
        </div>
      </div>
    </div>
  )
}
