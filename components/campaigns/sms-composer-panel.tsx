"use client"

import { useMemo, useRef } from "react"
import EmojiPicker from "emoji-picker-react"
import { User, UserRound, Phone, Mail, Smile } from "lucide-react"
import ChatAssistantButton from "@/components/chat-assistant-button"
import SmsPhonePreview from "@/components/campaigns/sms-phone-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { estimateCampaignCost, formatUsd } from "@/lib/sms-pricing"
import { estimateDeliveryTime } from "@/lib/sms-throughput"
import { calculateSmsSegments } from "@/lib/sms-utils"

interface SmsComposerPanelProps {
  message: string
  onMessageChange: (value: string) => void
  buyerIds: string[]
  recipientCount: number
  mediaUrls?: string[]
}

const STOP_SUFFIX_RE = /\s*Reply STOP to opt out\s*$/i

export default function SmsComposerPanel({ message, onMessageChange, buyerIds, recipientCount, mediaUrls = [] }: SmsComposerPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const segmentInfo = useMemo(() => calculateSmsSegments(message || ""), [message])
  const capacity = segmentInfo.segments === 1 ? (segmentInfo.encoding === "GSM-7" ? 160 : 70) : segmentInfo.segments * (segmentInfo.encoding === "GSM-7" ? 153 : 67)
  const charCount = capacity - segmentInfo.remaining
  const percentFull = Math.min(100, Math.max(0, (charCount / capacity) * 100))
  const hasMedia = false
  const cost = estimateCampaignCost({ recipients: recipientCount, segments: segmentInfo.segments, hasMedia })
  const throughput = estimateDeliveryTime(recipientCount, segmentInfo.segments)
  const hasStopFooter = STOP_SUFFIX_RE.test(message)

  const insertToken = (token: string) => {
    const el = textareaRef.current
    if (!el) {
      onMessageChange(`${message}${token}`)
      return
    }
    const start = el.selectionStart ?? message.length
    const end = el.selectionEnd ?? message.length
    const next = message.slice(0, start) + token + message.slice(end)
    onMessageChange(next)
  }

  const toggleStopFooter = (next: boolean) => {
    if (next && !hasStopFooter) onMessageChange((message + " Reply STOP to opt out").trim())
    if (!next && hasStopFooter) onMessageChange(message.replace(STOP_SUFFIX_RE, "").trimEnd())
  }

  return <div className="grid gap-4 md:grid-cols-12">
    <div className="space-y-4 md:col-span-7">
      <Textarea ref={textareaRef} rows={6} value={message || ""} onChange={(e) => onMessageChange(e.target.value)} placeholder="Hey {{first_name}}, just listed a property in your area..." autoFocus />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => insertToken("{{first_name}}")}><User className="h-3.5 w-3.5" />First name</Button>
        <Button size="sm" variant="outline" onClick={() => insertToken("{{last_name}}")}><UserRound className="h-3.5 w-3.5" />Last name</Button>
        <Button size="sm" variant="outline" onClick={() => insertToken("{{phone}}")}><Phone className="h-3.5 w-3.5" />Phone</Button>
        <Button size="sm" variant="outline" onClick={() => insertToken("{{email}}")}><Mail className="h-3.5 w-3.5" />Email</Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" type="button"><Smile className="h-3.5 w-3.5" />Emoji</Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" side="bottom">
            <EmojiPicker onEmojiClick={(e) => insertToken(e.emoji)} lazyLoadEmojis width={320} height={360} />
          </PopoverContent>
        </Popover>
        <ChatAssistantButton onInsert={(text) => onMessageChange(text.slice(0, 1530))} />
      </div>
      <div className="space-y-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Badge className="bg-brand text-white hover:bg-brand">{segmentInfo.segments} {segmentInfo.segments === 1 ? "segment" : "segments"}</Badge>
              <Badge variant="outline">{segmentInfo.encoding}</Badge>
              <span className="text-muted-foreground">{charCount} / {capacity} chars</span>
            </div>
            <span className="text-muted-foreground">{formatUsd(cost.perRecipient)} / recipient</span>
          </div>
          <Progress value={percentFull} className={segmentInfo.segments >= 10 ? "[&>div]:bg-red-500" : segmentInfo.segments >= 4 ? "[&>div]:bg-amber-500" : ""} />
          {recipientCount > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Est. delivery: <span className="font-medium text-foreground">{throughput.label}</span> · {throughput.poolSize} numbers × {throughput.perNumberMpm} MPM</span>
              <span>Total: <span className="font-medium text-foreground">{formatUsd(cost.total)}</span> for {recipientCount.toLocaleString()} recipients</span>
            </div>
          )}
          {segmentInfo.segments > 10 && <p className="text-sm text-red-600">Message exceeds the 10-segment Telnyx limit. Shorten it or split into multiple campaigns.</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-md border p-3">
        <Switch checked={hasStopFooter} onCheckedChange={toggleStopFooter} />
        <span className="text-sm">Append &apos;Reply STOP to opt out&apos; (10DLC compliance)</span>
      </div>
    </div>
    <div className="md:col-span-5"><SmsPhonePreview message={message} buyerIds={buyerIds} mediaUrls={mediaUrls} /></div>
  </div>
}
