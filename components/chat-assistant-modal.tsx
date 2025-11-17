"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { PromptService } from "@/services/prompt-service"
import { toast } from "@/hooks/use-toast"

interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

interface ChatAssistantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert?: (text: string) => void
}

export default function ChatAssistantModal({ open, onOpenChange, onInsert }: ChatAssistantModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [prompts, setPrompts] = useState<{ id: string; name: string; prompt: string }[]>([])
  const [selectedPrompt, setSelectedPrompt] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setMessages([
        {
          role: "system",
          content:
            "You are an expert RE copywriter who helps craft compelling real estate marketing copy.",
        },
      ])
      setInput("")
      setSelectedPrompt("")
      PromptService.listPrompts().then(setPrompts)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  const handleClose = () => {
    if (!loading) onOpenChange(false)
  }

  const adjustHeight = () => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 5 * 24) + "px"
  }

  const sendMessage = async () => {
    if (!input.trim()) return
    const history = [...messages, { role: "user" as const, content: input }]
    setMessages(history)
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "error")
      }
      const data = await res.json()
      setMessages([...history, { role: "assistant", content: data.content as string }])
    } catch (err) {
      console.error("Chat error", err)
      toast({ description: "Failed to get response", variant: "destructive" })
      setMessages(history)
    } finally {
      setLoading(false)
    }
  }

  const copyLatest = () => {
    const last = messages.filter((m) => m.role === "assistant").pop()
    if (last) {
      navigator.clipboard.writeText(last.content)
      toast({ description: "Copied to clipboard" })
    }
  }

  const copyAndInsertLatest = () => {
    const last = messages.filter((m) => m.role === "assistant").pop()
    if (last && onInsert) {
      navigator.clipboard.writeText(last.content)
      onInsert(last.content)
      toast({ description: "Copied to clipboard" })
      onOpenChange(false)
    }
  }

  const handlePromptSelect = (val: string) => {
    setSelectedPrompt(val)
    const p = prompts.find((pr) => pr.id === val)
    if (p) {
      setInput(p.prompt)
      requestAnimationFrame(adjustHeight)
    }
  }

  const savePrompt = async () => {
    const last = messages.filter((m) => m.role === "user").pop()
    if (!last) return
    const name = window.prompt("Prompt name", "")
    if (!name) return
    try {
      await PromptService.addPrompt({ name, prompt: last.content })
      toast({ description: "Prompt saved" })
    } catch (err) {
      console.error("Save prompt failed", err)
      toast({ description: "Failed to save prompt", variant: "destructive" })
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      sendMessage()
    }
  }

  const hasAssistant = messages.some((m) => m.role === "assistant")

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[500px] sm:w-[600px] rounded-2xl shadow-xl flex flex-col h-[70vh]">
        <DialogHeader className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white px-4 py-2 rounded-t-2xl">
          <DialogTitle className="text-white text-lg">How can I help you?</DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-2">
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`rounded px-3 py-2 text-sm max-w-[80%] ${
                      m.role === "user"
                        ? "bg-indigo-600 text-white"
                        : m.role === "assistant"
                        ? "bg-gray-100 text-gray-900"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-900 rounded px-3 py-2 text-sm flex space-x-1">
                    <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                adjustHeight()
              }}
              onKeyDown={onKeyDown}
              onInput={adjustHeight}
              rows={2}
              placeholder="Enter a message"
              className="flex-1 resize-none overflow-hidden min-h-[40px] max-h-[160px]"
            />
            <Select value={selectedPrompt} onValueChange={handlePromptSelect}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue placeholder="Prompt" />
              </SelectTrigger>
              <SelectContent>
                {prompts.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="cursor-pointer">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between border-t px-4 py-3">
          <div className="flex gap-2">
            {onInsert && (
              <Button variant="outline" size="sm" onClick={copyAndInsertLatest} disabled={!hasAssistant}>
                Copy & Insert
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={copyLatest} disabled={!hasAssistant}>
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={savePrompt} disabled={!messages.some((m) => m.role === "user")}>Save Prompt</Button>
            <Button variant="outline" size="sm" onClick={handleClose} disabled={loading}>Close</Button>
          </div>
          <Button onClick={sendMessage} disabled={loading || !input.trim()} size="sm">
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
