"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ALLOWED_MMS_EXTENSIONS,
  uploadMediaFile,
} from "../../utils/uploadMedia"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import EmojiPicker from "emoji-picker-react"
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command"
import GroupTreeSelector from "@/components/buyers/group-tree-selector"
import type { Buyer, Group } from "@/lib/supabase"
import { getGroups } from "@/lib/group-service"
import { CampaignService } from "@/services/campaign-service"
import { BuyerService } from "@/services/buyer-service"
import { toast } from "sonner"
import {
  Users,
  MessageSquare,
  Paperclip,
  CalendarClock,
  X,
  Check,
} from "lucide-react"
import Image from "next/image"
import { Progress } from "@/components/ui/progress"
import { useBuyerSuggestions } from "@/components/buyers/use-buyer-suggestions"
import { insertText, renderTemplate } from "@/lib/utils"
import { calculateSmsSegments } from "@/lib/sms-utils"
import { TemplateService } from "@/services/template-service"
import { PromptService } from "@/services/prompt-service"
import ChatAssistantButton from "@/components/chat-assistant-button"
import { useSession } from "@/hooks/use-session"
import { useRouter } from "next/navigation"

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour12 = i % 12 === 0 ? 12 : i % 12
  const ampm = i < 12 ? "AM" : "PM"
  const value = `${i.toString().padStart(2, "0")}:00`
  return { value, label: `${hour12}:00 ${ampm}` }
})

const ALLOWED_EXTENSIONS = ALLOWED_MMS_EXTENSIONS

const MAX_FILE_SIZE = 1 * 1024 * 1024

const STEPS = [
  "recipients",
  "message",
  "preview",
  "schedule",
] as const

interface SmsCampaignModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  onAiInsert?: (text: string) => void
}

function displayName(b: Buyer) {
  return b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed"
}

function MultiBuyerSelector({
  value,
  onChange,
  placeholder = "Search buyers...",
}: {
  value: Buyer[]
  onChange: (buyers: Buyer[]) => void
  placeholder?: string
}) {
  const [inputValue, setInputValue] = useState("")
  const [open, setOpen] = useState(false)
  const { results, loading } = useBuyerSuggestions(inputValue, open)

  const addBuyer = (buyer: Buyer) => {
    if (!value.find((b) => b.id === buyer.id)) {
      onChange([...value, buyer])
    }
    setInputValue("")
    setOpen(false)
  }

  const removeBuyer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter((b) => b.id !== id))
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 p-1 border rounded-md min-h-10 items-center">
        {value.map((b) => (
          <Badge key={b.id} variant="secondary" className="flex items-center gap-1 px-2 py-1">
            {displayName(b)}
            <X className="h-3 w-3 cursor-pointer" onClick={(e) => removeBuyer(b.id, e)} />
          </Badge>
        ))}
        <Command className="w-full relative overflow-visible">
          <CommandInput
            placeholder={value.length ? "" : placeholder}
            value={inputValue}
            onValueChange={setInputValue}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            onFocus={() => setOpen(true)}
            className="border-0 focus:ring-0 p-0 h-8"
          />
          {open && (
            <div className="absolute left-0 top-full z-10 w-full bg-popover border rounded-md shadow-md mt-1">
              <CommandList className="max-h-52 overflow-auto">
                {loading ? (
                  <div className="flex items-center justify-center p-4 text-sm">Searching...</div>
                ) : results.length > 0 ? (
                  <CommandGroup>
                    {results.map((buyer) => (
                      <CommandItem
                        key={buyer.id}
                        value={buyer.id}
                        onSelect={() => addBuyer(buyer)}
                        className="flex items-center"
                      >
                        <Users className="h-4 w-4 mr-2 text-green-600" />
                        <span>{displayName(buyer)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">No buyers found</div>
                )}
              </CommandList>
            </div>
          )}
        </Command>
      </div>
    </div>
  )
}


export default function SmsCampaignModal({ open, onOpenChange, onSuccess, onAiInsert }: SmsCampaignModalProps) {
  const [step, setStep] = useState<(typeof STEPS)[number]>("recipients")
  const [name, setName] = useState("")
  const [groups, setGroups] = useState<string[]>([])
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [templates, setTemplates] = useState<{ id: string; name: string; message: string }[]>([])
  const [prompts, setPrompts] = useState<{ id: string; name: string; prompt: string }[]>([])
  const [selectedPrompt, setSelectedPrompt] = useState<string>("")
  const [generating, setGenerating] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [showEmoji, setShowEmoji] = useState(false)
  const [allPhones, setAllPhones] = useState(true)
  const [sendNow, setSendNow] = useState(true)
  const [scheduleAt, setScheduleAt] = useState("")
  const [weekdayOnly, setWeekdayOnly] = useState(false)
  const [runFrom, setRunFrom] = useState("")
  const [runUntil, setRunUntil] = useState("")
  const [loading, setLoading] = useState(false)
  const [groupLabels, setGroupLabels] = useState<Record<string, string>>({})
  const [groupBuyerIds, setGroupBuyerIds] = useState<string[]>([])
  const stepIndex = STEPS.indexOf(step)
  const progressValue = (stepIndex / (STEPS.length - 1)) * 100
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user, loading: sessionLoading } = useSession()
  const [authToastShown, setAuthToastShown] = useState(false)
  const router = useRouter()
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  const previewBuyers = buyers.length
    ? buyers
    : [
        { id: "sample1", fname: "John", lname: "Doe" } as Buyer,
        { id: "sample2", fname: "Jane", lname: "Smith" } as Buyer,
      ]
  const previewBuyer = previewBuyers[previewIndex % previewBuyers.length]

  const selectedCount = new Set([
    ...buyers.map((b) => b.id),
    ...groupBuyerIds,
  ]).size

  useEffect(() => {
    if (open) {
      getGroups().then((list) => {
        const map: Record<string, string> = {}
        list.forEach((g: Group) => {
          map[g.id] = g.name
        })
        setGroupLabels(map)
      })
      TemplateService.listTemplates().then(setTemplates)
      PromptService.listPrompts().then(setPrompts)
    }
  }, [open])

  useEffect(() => {
    if (groups.length) {
      BuyerService.getBuyerIdsForGroups(groups).then(setGroupBuyerIds)
    } else {
      setGroupBuyerIds([])
    }
  }, [groups])

  const { segments: smsSegments, remaining } = calculateSmsSegments(message)
  const timeInvalid =
    runFrom && runUntil && runFrom >= runUntil

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length) setAttachments((prev) => [...prev, ...files])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length) setAttachments((prev) => [...prev, ...files])
  }

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleAiInsert = (text: string) => {
    setMessage(text.slice(0, 320))
    if (onAiInsert) onAiInsert(text)
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

  useEffect(() => {
    if (!open) {
      setAuthToastShown(false)
      return
    }
    if (!sessionLoading && !user && !authToastShown) {
      toast.error("Please sign in again", {
        action: {
          label: "Go to login",
          onClick: () => router.push("/login"),
        },
      })
      setAuthToastShown(true)
    }
  }, [open, sessionLoading, user, authToastShown, router])

  const insertEmoji = (emoji: string) => {
    insertPlaceholder(emoji)
    setShowEmoji(false)
  }

  const handlePromptSelect = async (val: string) => {
    setSelectedPrompt(val)
    const p = prompts.find((pr) => pr.id === val)
    if (p) {
      setGenerating(true)
      try {
        const finalPrompt = renderTemplate(p.prompt, previewBuyer)
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
    setStep("recipients")
    setName("")
    setGroups([])
    setBuyers([])
    setMessage("")
    setAttachments([])
    setSelectedTemplate("")
    setSelectedPrompt("")
    setShowEmoji(false)
    setAllPhones(true)
    setSendNow(true)
    setScheduleAt("")
    setWeekdayOnly(false)
    setRunFrom("")
    setRunUntil("")
  }

  const handleClose = () => {
    if (!loading) {
      reset()
      onOpenChange(false)
    }
  }

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please sign in again", {
        action: {
          label: "Go to login",
          onClick: () => router.push("/login"),
        },
      })
      return
    }
    if (!name.trim() || (!message.trim() && attachments.length === 0)) return
    if (!sendNow && timeInvalid) return
    for (const file of attachments) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`Unsupported file type: ${file.name}`)
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File ${file.name} exceeds 1MB limit`)
        return
      }
    }
    setLoading(true)
    try {
      const buyerIds = buyers.map((b) => b.id)
      const mediaUrls: string[] = []
      for (const file of attachments) {
        const url = await uploadMediaFile(file, "outgoing")
        mediaUrls.push(url)
      }
      let finalMessage = message.trim() ? message : ""
      const campaign = await CampaignService.createCampaign({
        name,
        channel: "sms",
        message: finalMessage,
        mediaUrls,
        buyerIds,
        groupIds: groups,
        sendToAllNumbers: allPhones,
        timezone: timeZone,
      })
      if (sendNow) {
        await CampaignService.sendNow(campaign.id)
      } else if (scheduleAt) {
        await CampaignService.schedule(
          campaign.id,
          new Date(scheduleAt).toISOString(),
          {
            weekdayOnly,
            runFrom: runFrom ? (runFrom.length === 5 ? `${runFrom}:00` : runFrom) : null,
            runUntil: runUntil ? (runUntil.length === 5 ? `${runUntil}:00` : runUntil) : null,
            timezone: timeZone,
          },
        )
      }
      toast.success("Campaign created")
      if (onSuccess) onSuccess()
      handleClose()
    } catch (err) {
      console.error("Failed to create campaign", err)
      toast.error("Failed to create campaign")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New SMS Campaign</DialogTitle>
          <DialogDescription>Create and schedule a text message blast.</DialogDescription>
        </DialogHeader>
        <Progress value={progressValue} className="h-2 mb-4" />
        <div className="mb-4 space-y-1">
          <label htmlFor="sms-campaign-name" className="block text-sm font-medium">Campaign Name</label>
          <Input
            id="sms-campaign-name"
            name="sms-campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {!name.trim() && <p className="text-xs text-red-600">Name is required</p>}
        </div>
        <Tabs value={step} onValueChange={setStep} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger
              value="recipients"
              data-complete={stepIndex > 0}
              className="flex items-center gap-2 data-[complete=true]:text-green-600"
            >
              {stepIndex > 0 ? (
                <Check className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}{" "}
              Recipients
            </TabsTrigger>
            <TabsTrigger
              value="message"
              data-complete={stepIndex > 1}
              className="flex items-center gap-2 data-[complete=true]:text-green-600"
            >
              {stepIndex > 1 ? (
                <Check className="h-4 w-4" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}{" "}
              Message
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              data-complete={stepIndex > 2}
              className="flex items-center gap-2 data-[complete=true]:text-green-600"
            >
              {stepIndex > 2 ? (
                <Check className="h-4 w-4" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}{" "}
              Preview
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              data-complete={stepIndex > 3}
              className="flex items-center gap-2 data-[complete=true]:text-green-600"
            >
              {stepIndex > 3 ? (
                <Check className="h-4 w-4" />
              ) : (
                <CalendarClock className="h-4 w-4" />
              )}{" "}
              Schedule
            </TabsTrigger>
          </TabsList>
          <TabsContent value="recipients" className="space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium">Groups</label>
          <GroupTreeSelector value={groups} onChange={setGroups} allowCreate={false} />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">Buyers</label>
          <MultiBuyerSelector value={buyers} onChange={setBuyers} />
        </div>
        <p className="text-sm text-muted-foreground">
          Total contacts selected: {selectedCount}
        </p>
        <div className="flex items-center gap-2">
              <Switch id="allPhones" checked={allPhones} onCheckedChange={setAllPhones} />
              <label htmlFor="allPhones" className="text-sm">
                Send to all phone numbers
              </label>
            </div>
          </TabsContent>
          <TabsContent value="message" className="space-y-2">
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
                <ChatAssistantButton onInsert={handleAiInsert} />
              </div>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {attachments.map((file, idx) => {
                    const lower = file.name.toLowerCase();
                    const isImg = /(jpg|jpeg|png|gif|bmp|webp)$/.test(lower);
                    const isAudio = /(m4a|mp3|wav|ogg)$/.test(lower);
                    const url = URL.createObjectURL(file);
                    return (
                      <div key={idx} className="relative inline-block">
                        {isImg ? (
                          <Image
                            src={url}
                            alt="preview"
                            width={128}
                            height={128}
                            className="max-h-32 rounded-md"
                          />
                        ) : isAudio ? (
                          <audio controls className="max-h-32">
                            <source src={url} type="audio/mpeg" />
                            Your browser doesn’t support audio.
                          </audio>
                        ) : (
                          <span className="block text-xs">{file.name}</span>
                        )}
                        <X
                          className="h-4 w-4 absolute -right-2 -top-2 bg-white dark:bg-gray-800 rounded-full cursor-pointer"
                          onClick={() => removeAttachment(idx)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {generating && <p className="text-xs text-muted-foreground">Generating...</p>}
              <div
                className={`flex justify-between text-xs ${smsSegments > 1 ? "text-red-600" : "text-muted-foreground"}`}
              >
                <span>
                  {remaining} characters remaining · {smsSegments} segment
                  {smsSegments > 1 ? "s" : ""}
                </span>
                {!message.trim() && attachments.length === 0 && (
                  <span>Message or attachment required</span>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="preview" className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium">Sample Buyer</label>
              <Select
                value={String(previewIndex)}
                onValueChange={(v) => setPreviewIndex(Number(v))}
              >
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="Buyer" />
                </SelectTrigger>
                <SelectContent>
                  {previewBuyers.map((b, idx) => (
                    <SelectItem key={b.id} value={String(idx)}>
                      {displayName(b)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded-md p-4 whitespace-pre-wrap">
              {renderTemplate(message, previewBuyer)}
            </div>
          </TabsContent>
          <TabsContent value="schedule" className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch checked={!sendNow} onCheckedChange={(v) => setSendNow(!v)} id="sendAtToggle" />
              <label htmlFor="sendAtToggle" className="text-sm">
                {sendNow ? "Send Now" : "Send At"}
              </label>
            </div>
            {!sendNow && (
              <Input
                id="sms-campaign-schedule"
                name="sms-campaign-schedule"
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
            )}
            {!sendNow && (
              <p className="text-xs text-muted-foreground">
                Times are in your local timezone: {timeZone}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Checkbox id="weekdayOnly" checked={weekdayOnly} onCheckedChange={(v) => setWeekdayOnly(!!v)} />
              <label htmlFor="weekdayOnly" className="text-sm">
                Run Monday through Friday
              </label>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block mb-1 text-sm font-medium">Run From</label>
                <Select value={runFrom} onValueChange={setRunFrom}>
                  <SelectTrigger>
                    <SelectValue placeholder="Start" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="block mb-1 text-sm font-medium">Run Until</label>
                <Select value={runUntil} onValueChange={setRunUntil}>
                  <SelectTrigger>
                    <SelectValue placeholder="End" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {timeInvalid && (
              <p className="text-xs text-red-600">Run From must be before Run Until</p>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          {step !== "schedule" ? (
            <Button
              onClick={() => {
                const next = STEPS[stepIndex + 1]
                if (next) setStep(next)
              }}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={
                loading ||
                !name.trim() ||
                (!message.trim() && attachments.length === 0) ||
                (!sendNow && timeInvalid) ||
                sessionLoading ||
                !user
              }
            >
              {sessionLoading
                ? "Checking session..."
                : loading
                  ? "Saving..."
                  : sendNow
                    ? "Send Now"
                    : "Schedule"}
            </Button>
          )}
          {sessionLoading && (
            <span className="text-xs text-muted-foreground">Verifying your session…</span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
