"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import ChatAssistantModal from "./chat-assistant-modal"

interface ChatAssistantButtonProps {
  className?: string
  onInsert?: (text: string) => void
}

export default function ChatAssistantButton({ className, onInsert }: ChatAssistantButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)} className={className} size="sm">
        AI Assistant
      </Button>
      <ChatAssistantModal open={open} onOpenChange={setOpen} onInsert={onInsert} />
    </>
  )
}
