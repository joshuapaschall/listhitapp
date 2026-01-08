"use client"

// Uses react-quill for rich text editing
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import dynamic from "next/dynamic"
import type ReactQuillType from "react-quill"
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false })
import "react-quill/dist/quill.snow.css"

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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command"
import GroupTreeSelector from "@/components/buyers/group-tree-selector"
import type { Buyer, Group, Tag } from "@/lib/supabase"
import { getGroups } from "@/lib/group-service"
import { CampaignService } from "@/services/campaign-service"
import { BuyerService } from "@/services/buyer-service"
import { toast } from "sonner"
import {
  Users,
  MessageSquare,
  X,
  Check,
  Calendar as CalendarIcon,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useBuyerSuggestions } from "@/components/buyers/use-buyer-suggestions"
import { renderTemplate } from "@/lib/utils"
import ChatAssistantButton from "@/components/chat-assistant-button"
import TagFilterSelector from "@/components/buyers/tag-filter-selector"
import LocationFilterSelector from "@/components/buyers/location-filter-selector"
import { useSession } from "@/hooks/use-session"
import { useRouter } from "next/navigation"

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour12 = i % 12 === 0 ? 12 : i % 12
  const ampm = i < 12 ? "AM" : "PM"
  const value = `${i.toString().padStart(2, "0")}:00`
  return { value, label: `${hour12}:00 ${ampm}` }
})

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => `${i + 1}`)
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => `${i * 5}`.padStart(2, "0"))

const to24Hour = (hour: string, period: "AM" | "PM") => {
  const parsed = Number(hour)
  if (period === "AM") {
    return parsed === 12 ? 0 : parsed
  }
  return parsed === 12 ? 12 : parsed + 12
}

const roundToNearestFive = (date: Date) => {
  const rounded = new Date(date)
  rounded.setSeconds(0, 0)
  const minutes = rounded.getMinutes()
  const remainder = minutes % 5
  if (remainder === 0) return rounded
  const delta = remainder >= 3 ? 5 - remainder : -remainder
  rounded.setMinutes(minutes + delta)
  return rounded
}

const STEPS = ["recipients", "message"] as const

interface EmailCampaignModalProps {
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

export default function NewEmailCampaignModal({ open, onOpenChange, onSuccess, onAiInsert }: EmailCampaignModalProps) {
  const [step, setStep] = useState<(typeof STEPS)[number]>("recipients")
  const [name, setName] = useState("")
  const [groups, setGroups] = useState<string[]>([])
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [minScore, setMinScore] = useState("")
  const [maxScore, setMaxScore] = useState("")
  const [subject, setSubject] = useState("")
  const [html, setHtml] = useState("")
  const [sendNow, setSendNow] = useState(true)
  const [scheduleAt, setScheduleAt] = useState("")
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null)
  const [scheduleHour, setScheduleHour] = useState("12")
  const [scheduleMinute, setScheduleMinute] = useState("00")
  const [schedulePeriod, setSchedulePeriod] = useState<"AM" | "PM">("PM")
  const [weekdayOnly, setWeekdayOnly] = useState(false)
  const [runFrom, setRunFrom] = useState("")
  const [runUntil, setRunUntil] = useState("")
  const [loading, setLoading] = useState(false)
  const [groupLabels, setGroupLabels] = useState<Record<string, string>>({})
  const [groupBuyerIds, setGroupBuyerIds] = useState<string[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<{ count: number; sample: string[] }>({
    count: 0,
    sample: [],
  })
  const [testRecipient, setTestRecipient] = useState("")
  const [sendingTest, setSendingTest] = useState(false)
  const debounceRef = useRef<any>(null)
  const quillRef = useRef<ReactQuillType | null>(null)
  const payloadLogRef = useRef(false)
  const stepIndex = STEPS.indexOf(step)
  const progressValue = (stepIndex / (STEPS.length - 1)) * 100
  const selectedCount = new Set([
    ...buyers.map((b) => b.id),
    ...groupBuyerIds,
  ]).size
  const { user, loading: sessionLoading } = useSession()
  const [authToastShown, setAuthToastShown] = useState(false)
  const router = useRouter()
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"],
      ],
      handlers: {
        link: () => {
          const editor = quillRef.current?.getEditor()
          if (!editor) return
          const range = editor.getSelection()
          if (!range) return
          const input = window.prompt("Enter link URL (https://...):")
          if (!input) return editor.format("link", false)
          const url = /^https?:\/\//i.test(input) ? input : `https://${input}`
          if (range.length === 0) {
            editor.insertText(range.index, url, "link", url)
            editor.setSelection(range.index + url.length, 0)
          } else {
            editor.format("link", url)
          }
        },
      },
    },
  }), [])

  const syncScheduleAt = useCallback(({
    date = scheduleDate,
    hour = scheduleHour,
    minute = scheduleMinute,
    period = schedulePeriod,
  }: {
    date?: Date | null
    hour?: string
    minute?: string
    period?: "AM" | "PM"
  }) => {
    if (!date) {
      setScheduleAt("")
      return
    }
    const scheduled = new Date(date)
    scheduled.setHours(to24Hour(hour, period))
    scheduled.setMinutes(Number(minute))
    scheduled.setSeconds(0)
    scheduled.setMilliseconds(0)
    const year = scheduled.getFullYear()
    const month = `${scheduled.getMonth() + 1}`.padStart(2, "0")
    const day = `${scheduled.getDate()}`.padStart(2, "0")
    const hours = `${scheduled.getHours()}`.padStart(2, "0")
    setScheduleAt(`${year}-${month}-${day}T${hours}:${minute}`)
  }, [scheduleDate, scheduleHour, scheduleMinute, schedulePeriod])

  const setScheduleStateFromDate = useCallback((date: Date) => {
    const rounded = roundToNearestFive(date)
    const hours24 = rounded.getHours()
    const minutes = `${rounded.getMinutes()}`.padStart(2, "0")
    const period = hours24 >= 12 ? "PM" : "AM"
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
    setScheduleDate(rounded)
    setScheduleHour(`${hours12}`)
    setScheduleMinute(MINUTE_OPTIONS.includes(minutes) ? minutes : "00")
    setSchedulePeriod(period)
    syncScheduleAt({
      date: rounded,
      hour: `${hours12}`,
      minute: MINUTE_OPTIONS.includes(minutes) ? minutes : "00",
      period,
    })
  }, [syncScheduleAt])

  const setNextDefaultSchedule = useCallback(() => {
    const now = new Date()
    const next = new Date(now)
    next.setSeconds(0, 0)
    const remainder = now.getMinutes() % 5 === 0 ? 5 : 5 - (now.getMinutes() % 5)
    next.setMinutes(now.getMinutes() + remainder)
    setScheduleStateFromDate(next)
  }, [setScheduleStateFromDate])

  const applyQuickPick = useCallback((minutesToAdd: number) => {
    const now = new Date()
    const target = new Date(now.getTime() + minutesToAdd * 60 * 1000)
    const rounded = roundToNearestFive(target)
    setScheduleStateFromDate(rounded)
  }, [setScheduleStateFromDate])

  useEffect(() => {
    if (open) {
      getGroups().then((list) => {
        const map: Record<string, string> = {}
        list.forEach((g: Group) => {
          map[g.id] = g.name
        })
        setGroupLabels(map)
      })
      BuyerService.getTags().then(setAvailableTags).catch(() => setAvailableTags([]))
    }
  }, [open])

  useEffect(() => {
    if (groups.length) {
      BuyerService.getBuyerIdsForGroups(groups).then(setGroupBuyerIds)
    } else {
      setGroupBuyerIds([])
    }
  }, [groups])

  const fetchPreview = async (groupIds: string[]) => {
    try {
      setPreviewLoading(true)
      const res = await fetch("/api/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Preview failed")
      setPreview({ count: data.count || 0, sample: data.sample || [] })
    } catch {
      setPreview({ count: 0, sample: [] })
    } finally {
      setPreviewLoading(false)
    }
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!Array.isArray(groups)) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchPreview(groups)
    }, 350)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [JSON.stringify(groups)])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!sendNow && !scheduleAt) {
      setNextDefaultSchedule()
    }
  }, [sendNow, scheduleAt, setNextDefaultSchedule])

  const timeInvalid = runFrom && runUntil && runFrom >= runUntil

  const insertPlaceholder = (text: string) => {
    const quill = quillRef.current?.getEditor()
    if (!quill) return
    const range = quill.getSelection(true)
    const index = range ? range.index : quill.getLength()
    quill.insertText(index, text)
    quill.setSelection(index + text.length, 0)
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

  const handleAiInsert = (text: string) => {
    setHtml(text)
    if (onAiInsert) onAiInsert(text)
  }

  const reset = () => {
    setStep("recipients")
    setName("")
    setGroups([])
    setBuyers([])
    setSelectedTags([])
    setLocations([])
    setMinScore("")
    setMaxScore("")
    setSubject("")
    setHtml("")
    setSendNow(true)
    setScheduleAt("")
    setScheduleDate(null)
    setScheduleHour("12")
    setScheduleMinute("00")
    setSchedulePeriod("PM")
    setWeekdayOnly(false)
    setRunFrom("")
    setRunUntil("")
    setPreview({ count: 0, sample: [] })
    setPreviewLoading(false)
    setTestRecipient("")
    setSendingTest(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
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
    if (!name.trim() || !subject.trim() || !html.trim()) return
    if (!sendNow && timeInvalid) return
    let scheduledAtIso: string | null = null
    let normalizedRunFrom: string | null | undefined = undefined
    let normalizedRunUntil: string | null | undefined = undefined
    if (!sendNow) {
      if (!scheduleAt) {
        toast.error("Please choose a send time")
        return
      }
      const parsedSchedule = new Date(scheduleAt)
      if (Number.isNaN(parsedSchedule.getTime())) {
        toast.error("Please choose a valid send time")
        return
      }
      scheduledAtIso = parsedSchedule.toISOString()
      normalizedRunFrom = runFrom ? (runFrom.length === 5 ? `${runFrom}:00` : runFrom) : null
      normalizedRunUntil = runUntil ? (runUntil.length === 5 ? `${runUntil}:00` : runUntil) : null
    }
    setLoading(true)
    try {
      const buyerIds = buyers.map((b) => b.id)
      const filters = {
        tags: selectedTags.length ? selectedTags : undefined,
        locations: locations.length ? locations : undefined,
        minScore: minScore ? Number(minScore) : undefined,
        maxScore: maxScore ? Number(maxScore) : undefined,
      }
      const payload = {
        name,
        channel: "email",
        subject,
        message: html,
        buyerIds,
        groupIds: groups,
        filters,
        scheduled_at: scheduledAtIso ?? undefined,
        weekday_only: scheduledAtIso ? (weekdayOnly ? true : null) : undefined,
        run_from: scheduledAtIso ? normalizedRunFrom : undefined,
        run_until: scheduledAtIso ? normalizedRunUntil : undefined,
        timezone: timeZone,
      }
      if (!payloadLogRef.current && process.env.NODE_ENV !== "production") {
        console.log("Campaign payload", payload)
        payloadLogRef.current = true
      }
      const campaign = await CampaignService.createCampaign(payload)
      if (sendNow) {
        await CampaignService.sendNow(campaign.id)
      }
      toast.success("Campaign created")
      if (onSuccess) onSuccess()
      handleClose()
    } catch (err) {
      console.error("Failed to create campaign", err)
      let errorMessage = "Failed to create campaign"
      if (err instanceof Error && err.message) {
        errorMessage = err.message
      } else if (err && typeof err === "object" && "message" in err) {
        const supabaseError = err as { message: string; details?: string; hint?: string }
        errorMessage = [supabaseError.message, supabaseError.details, supabaseError.hint]
          .filter(Boolean)
          .join(" ")
      }
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleSendTest = async () => {
    const to = (testRecipient || buyers[0]?.email || "").trim()
    if (!subject.trim() || !html.trim()) {
      toast.error("Subject and message are required")
      return
    }
    if (!to) {
      toast.error("Please enter a test recipient email")
      return
    }
    setSendingTest(true)
    try {
      const res = await fetch("/api/campaigns/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to send test email")
      }
      toast.success("Test email sent")
    } catch (err) {
      console.error("Failed to send test email", err)
      toast.error(err instanceof Error ? err.message : "Failed to send test email")
    } finally {
      setSendingTest(false)
    }
  }

  const handlePreview = () => {
    const sampleBuyer = { fname: "John", lname: "Doe" } as Buyer
    const htmlOut = renderTemplate(html, sampleBuyer)
    const win = window.open("", "_blank")
    if (win) {
      win.document.write(htmlOut)
      win.document.close()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl p-0">
        <div className="flex flex-col h-[90vh]">
          <header className="border-b p-6 shrink-0">
            <DialogHeader>
              <DialogTitle>New Email Campaign</DialogTitle>
              <DialogDescription>Create and schedule an email blast.</DialogDescription>
            </DialogHeader>
            <Progress value={progressValue} className="h-2 mt-4" />
          </header>
          <section className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-1">
              <label htmlFor="campaign-name" className="block text-sm font-medium">Campaign Name</label>
              <Input
                id="campaign-name"
                name="campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {!name.trim() && <p className="text-xs text-red-600">Name is required</p>}
            </div>
            <Tabs value={step} onValueChange={setStep} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger
                  value="recipients"
                  data-complete={stepIndex > 0}
                  className="flex items-center gap-2 data-[complete=true]:text-green-600"
                >
                  {stepIndex > 0 ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />} Recipients
                </TabsTrigger>
                <TabsTrigger
                  value="message"
                  data-complete={stepIndex > 1}
                  className="flex items-center gap-2 data-[complete=true]:text-green-600"
                >
                  {stepIndex > 1 ? <Check className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />} Message
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
                <div>
                  <label className="block mb-1 text-sm font-medium">Tags</label>
                  <TagFilterSelector
                    availableTags={availableTags}
                    selectedTags={selectedTags}
                    onChange={setSelectedTags}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">Locations</label>
                  <LocationFilterSelector
                    selectedLocations={locations}
                    onChange={setLocations}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label htmlFor="minScore" className="block mb-1 text-sm font-medium">Min Score</label>
                    <Input
                      id="minScore"
                      type="number"
                      value={minScore}
                      onChange={(e) => setMinScore(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="maxScore" className="block mb-1 text-sm font-medium">Max Score</label>
                    <Input
                      id="maxScore"
                      type="number"
                      value={maxScore}
                      onChange={(e) => setMaxScore(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total contacts selected: {selectedCount}
                </p>
                <div className="mt-3 rounded-xl border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      Recipients Preview {previewLoading ? "…" : `(${preview.count})`}
                    </div>
                    <div
                      className={`px-2 py-1 rounded-lg text-xs ${
                        preview.count > 0 ? "bg-emerald-50" : "bg-amber-50"
                      }`}
                    >
                      {preview.count > 0 ? "Ready to send" : "No recipients"}
                    </div>
                  </div>
                  {preview.sample.length > 0 && (
                    <div className="mt-2 text-muted-foreground">
                      <div className="mb-1">Sample:</div>
                      <ul className="list-disc ml-5">
                        {preview.sample.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {preview.count === 0 && !previewLoading && (
                    <div className="mt-2 text-amber-700">
                      Select at least one group with eligible buyers (visible + emailable).
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="message" className="space-y-4">
                <div>
                  <label htmlFor="campaign-subject" className="block mb-1 text-sm font-medium">Subject</label>
                  <Input
                    id="campaign-subject"
                    name="campaign-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                  {!subject.trim() && <p className="text-xs text-red-600">Subject is required</p>}
                </div>
                <div className="w-full">
                  <label className="block text-sm font-medium mb-1">Message</label>
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={html}
                    onChange={setHtml}
                    className="bg-white h-64 w-full"
                    modules={quillModules}
                  />
                  <div className="flex gap-2 mt-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">Fields</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => insertPlaceholder("{{first_name}}")}>First Name</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => insertPlaceholder("{{last_name}}")}>Last Name</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <ChatAssistantButton onInsert={handleAiInsert} />
                  </div>
                  {!html.trim() && <p className="text-xs text-red-600">Message is required</p>}
                </div>
                <div className="space-y-1">
                  <label htmlFor="test-recipient" className="block text-sm font-medium">Test recipient email</label>
                  <Input
                    id="test-recipient"
                    name="test-recipient"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="you@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use the first selected buyer (if available).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={sendNow}
                    onCheckedChange={(checked) => {
                      setSendNow(checked)
                      if (!checked && !scheduleAt) {
                        setNextDefaultSchedule()
                      }
                    }}
                    id="sendAtToggle"
                  />
                  <label htmlFor="sendAtToggle" className="text-sm">
                    {sendNow ? "Send Now" : "Send At"}
                  </label>
                  <span className="text-xs text-muted-foreground">Timezone: {timeZone}</span>
                </div>
                {sendNow === false && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {scheduleDate
                                ? scheduleDate.toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={scheduleDate ?? undefined}
                              onSelect={(date) => {
                                if (date) {
                                  setScheduleStateFromDate(date)
                                } else {
                                  setScheduleDate(null)
                                  setScheduleAt("")
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Time</label>
                        <div className="grid grid-cols-3 gap-2">
                          <Select
                            value={scheduleHour}
                            onValueChange={(val) => {
                              setScheduleHour(val)
                              syncScheduleAt({ hour: val })
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Hour" />
                            </SelectTrigger>
                            <SelectContent>
                              {HOUR_OPTIONS.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={scheduleMinute}
                            onValueChange={(val) => {
                              setScheduleMinute(val)
                              syncScheduleAt({ minute: val })
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Minute" />
                            </SelectTrigger>
                            <SelectContent>
                              {MINUTE_OPTIONS.map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={schedulePeriod}
                            onValueChange={(val) => {
                              const nextPeriod = val as "AM" | "PM"
                              setSchedulePeriod(nextPeriod)
                              syncScheduleAt({ period: nextPeriod })
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="AM/PM" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AM">AM</SelectItem>
                              <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Quick picks
                            </span>
                            <div className="grid flex-1 grid-cols-5 gap-1">
                              {[
                                { label: "5 mins", minutes: 5 },
                                { label: "10 mins", minutes: 10 },
                                { label: "15 mins", minutes: 15 },
                                { label: "30 mins", minutes: 30 },
                                { label: "1 hour", minutes: 60 },
                              ].map((item) => (
                                <Button
                                  key={item.label}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => applyQuickPick(item.minutes)}
                                >
                                  {item.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Times are in your local timezone: {timeZone}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox id="weekdayOnly" checked={weekdayOnly} onCheckedChange={(v) => setWeekdayOnly(!!v)} />
                  <label htmlFor="weekdayOnly" className="text-sm">Run Monday through Friday</label>
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
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {timeInvalid && (
                  <p className="text-xs text-red-600">Run From must be before Run Until</p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendTest}
                    disabled={sendingTest}
                  >
                    {sendingTest ? "Sending..." : "Send Test"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePreview}
                    >Preview</Button>
                </div>
              </TabsContent>

            </Tabs>
          </section>
          <DialogFooter className="flex justify-end gap-3 border-t p-4 shrink-0">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            {step !== "message" ? (
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
                  previewLoading ||
                  preview.count === 0 ||
                  !name.trim() ||
                  !subject.trim() ||
                  !html.trim() ||
                  (!sendNow && !scheduleAt) ||
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
