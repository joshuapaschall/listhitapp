"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import EmojiPicker from "emoji-picker-react"
import { ChevronDown, Clipboard, Link as LinkIcon, Mail, Phone, Smile, User, UserRound } from "lucide-react"
import AssistantButton from "@/components/chat-assistant-button"
import SmsPhonePreview from "@/components/campaigns/sms-phone-preview"
import TemplatePicker from "@/components/templates/template-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { estimateCampaignCost, formatUsd } from "@/lib/sms-pricing"
import { estimateDeliveryTime, fetchMessagingThroughput } from "@/lib/sms-throughput"
import { calculateSmsSegments } from "@/lib/sms-utils"
import { applyShortLinkPreview, sampleSlug, shortLinkLength, type ShortLinkConfig } from "@/lib/shortlink-preview"
import SmsCostGuard from "@/components/campaigns/sms-cost-guard"

interface SmsComposerPanelProps {
  message: string
  onMessageChange: (value: string) => void
  buyerIds: string[]
  recipientCount: number
  mediaUrls?: string[]
  shortenLinks: boolean
  onShortenLinksChange: (value: boolean) => void
  shortConfig: ShortLinkConfig
}

const STOP_SUFFIX_RE = /\s*Reply STOP to opt out\s*$/i

export default function SmsComposerPanel({ message, onMessageChange, buyerIds, recipientCount, mediaUrls = [], shortenLinks, onShortenLinksChange, shortConfig }: SmsComposerPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [throughputConfig, setThroughputConfig] = useState({ poolSize: 15, perNumberMpm: 2 })
  const shortenActive = shortenLinks && shortConfig.configured
  const linkPreview = useMemo(
    () => applyShortLinkPreview(message || "", shortConfig.domain, shortConfig.slugLength),
    [message, shortConfig.domain, shortConfig.slugLength],
  )
  const effectiveMessage = shortenActive ? linkPreview.effective : message || ""
  const segmentInfo = useMemo(() => calculateSmsSegments(effectiveMessage), [effectiveMessage])
  const charCount = segmentInfo.charCount
  const capacity = segmentInfo.segments <= 1 ? segmentInfo.charsPerSegment : segmentInfo.segments * segmentInfo.charsPerSegment
  const percentFull = Math.min(100, Math.max(0, (charCount / Math.max(1, capacity)) * 100))
  const hasMedia = false
  const cost = estimateCampaignCost({ recipients: recipientCount, segments: segmentInfo.segments, hasMedia })
  const throughput = estimateDeliveryTime({
    recipients: recipientCount,
    segments: segmentInfo.segments,
    poolSize: throughputConfig.poolSize,
    perNumberMpm: throughputConfig.perNumberMpm,
  })
  const hasStopFooter = STOP_SUFFIX_RE.test(message)

  useEffect(() => {
    let mounted = true

    fetchMessagingThroughput()
      .then(({ poolSize, perNumberMpm }) => {
        if (mounted) setThroughputConfig({ poolSize, perNumberMpm })
      })
      .catch((err) => {
        console.error("Failed to fetch messaging throughput", err)
      })

    return () => {
      mounted = false
    }
  }, [])

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
      <div className="flex flex-wrap items-center gap-3">
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="sr-only" aria-hidden="true">Open emoji picker</button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" side="bottom">
            <EmojiPicker onEmojiClick={(e) => insertToken(e.emoji)} lazyLoadEmojis width={320} height={360} />
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" type="button" className="gap-2">
              Insert field
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onSelect={() => insertToken("{{first_name}}")}> <User className="h-3.5 w-3.5" />First name</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => insertToken("{{last_name}}")}> <UserRound className="h-3.5 w-3.5" />Last name</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => insertToken("{{phone}}")}> <Phone className="h-3.5 w-3.5" />Phone</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => insertToken("{{email}}")}> <Mail className="h-3.5 w-3.5" />Email</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(event) => {
              event.preventDefault()
              setEmojiOpen(true)
            }}>
              <Smile className="h-3.5 w-3.5" />Emoji
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <TemplatePicker
          type="sms"
          manageHref="/settings/templates/sms"
          onSelect={(t) => insertToken(t.message)}
          trigger={
            <Button size="sm" variant="outline" type="button" className="gap-2 text-brand hover:text-brand">
              <Clipboard className="h-3.5 w-3.5" />
              Insert template
            </Button>
          }
        />

        {/* ChatAssistantButton */}
        <AssistantButton onInsert={(text) => onMessageChange(text.slice(0, 1530))} />
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
          {charCount > 0 && (
            segmentInfo.remaining <= 0 ? (
              <p className="text-xs font-medium text-red-600">
                At the segment {segmentInfo.segments} limit — one more character adds a segment.
              </p>
            ) : (
              <p className={`text-xs font-medium ${segmentInfo.remaining <= 15 ? "text-amber-600" : "text-muted-foreground"}`}>
                {segmentInfo.remaining} characters before segment {segmentInfo.segments + 1}
              </p>
            )
          )}
          {recipientCount > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Est. delivery: <span className="font-medium text-foreground">{throughput.label}</span> · {throughput.poolSize} numbers × {throughput.perNumberMpm} MPM</span>
              <span>Total: <span className="font-medium text-foreground">{formatUsd(cost.total)}</span> for {recipientCount.toLocaleString()} recipients</span>
            </div>
          )}
          {segmentInfo.segments > 10 && <p className="text-sm text-red-600">Message exceeds the 10-segment Telnyx limit. Shorten it or split into multiple campaigns.</p>}
        </div>
        {shortenActive && linkPreview.urlCount > 0 && (
          <div className="rounded-md border p-3 text-xs">
            <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
              <LinkIcon className="h-3.5 w-3.5" /> Counted as (what recipients get)
            </div>
            <div className="break-all font-mono text-foreground">
              <span className="text-muted-foreground">https://</span>
              {shortConfig.domain}
              <span className="text-muted-foreground">/</span>
              <span className="rounded bg-brand/10 px-1 py-0.5 text-brand">{sampleSlug(shortConfig.slugLength)}</span>
            </div>
            <p className="mt-1 text-muted-foreground">
              {shortLinkLength(shortConfig.domain, shortConfig.slugLength)} chars · the {shortConfig.slugLength}-char code is unique per recipient and always counted
            </p>
          </div>
        )}
      </div>
      <SmsCostGuard message={message} onApply={onMessageChange} />
      <div className="flex items-center gap-3 rounded-md border p-3">
        <Switch checked={shortenLinks} onCheckedChange={onShortenLinksChange} disabled={!shortConfig.configured} />
        <div>
          <p className="text-sm">
            Shorten links{" "}
            {shortConfig.configured
              ? <span className="text-muted-foreground">· click tracking on</span>
              : <span className="text-muted-foreground">· no short domain configured</span>}
          </p>
          {shortConfig.configured
            ? <p className="text-xs text-muted-foreground">Using <span className="font-mono">{shortConfig.domain}</span></p>
            : <p className="text-xs text-muted-foreground">Set a short-link domain to enable link shortening and click tracking.</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-md border p-3">
        <Switch checked={hasStopFooter} onCheckedChange={toggleStopFooter} />
        <span className="text-sm">Append &apos;Reply STOP to opt out&apos; (10DLC compliance)</span>
      </div>
    </div>
    <div className="md:col-span-5"><SmsPhonePreview message={message} buyerIds={buyerIds} mediaUrls={mediaUrls} shortenActive={shortenActive} shortDomain={shortConfig.domain} slugLength={shortConfig.slugLength} /></div>
  </div>
}
