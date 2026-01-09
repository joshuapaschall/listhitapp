"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"
import { supabaseBrowser } from "@/lib/supabase-browser"

const SYSTEM_LINK_FRAGMENT = "/api/unsubscribe"

type RecipientBuyer = {
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

type Recipient = {
  id: string
  status?: string | null
  buyer?: RecipientBuyer | null
}

type EmailEvent = {
  id: string
  event_type: string
  created_at: string
  payload: any
}

type RecipientDrilldownSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId: string
  recipient: Recipient | null
}

const statusBadgeStyles: Record<string, string> = {
  delivered: "bg-emerald-100 text-emerald-800",
  open: "bg-blue-100 text-blue-800",
  click: "bg-indigo-100 text-indigo-800",
  bounce: "bg-amber-100 text-amber-800",
  complaint: "bg-rose-100 text-rose-800",
  unsubscribe: "bg-slate-100 text-slate-800",
  unsub: "bg-slate-100 text-slate-800",
}

function formatName(buyer?: RecipientBuyer | null) {
  if (!buyer) return "Unknown buyer"
  const fullName = [buyer.first_name, buyer.last_name].filter(Boolean).join(" ")
  return fullName || buyer.email || "Unknown buyer"
}

function getEventUrl(payload: any) {
  if (!payload) return null
  return (
    payload?.click?.link ||
    payload?.click?.url ||
    payload?.link ||
    payload?.url ||
    null
  )
}

function isSystemLink(url?: string | null) {
  return !!url && url.includes(SYSTEM_LINK_FRAGMENT)
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function formatEventType(eventType: string) {
  if (!eventType) return "event"
  return eventType.replace(/_/g, " ")
}

function buildDiagnosticDetails(event: EmailEvent | undefined) {
  if (!event) return []
  const payload = event.payload || {}
  if (event.event_type === "bounce") {
    const bounce = payload?.bounce || payload?.Bounce || payload?.notification?.bounce || {}
    const recipients = bounce?.bouncedRecipients?.[0] || {}
    return [
      { label: "Type", value: bounce?.bounceType || bounce?.BounceType },
      { label: "Sub-type", value: bounce?.bounceSubType },
      { label: "Diagnostic", value: bounce?.diagnosticCode || recipients?.diagnosticCode },
      { label: "Status", value: recipients?.status },
      { label: "Action", value: recipients?.action },
      { label: "Reporting MTA", value: bounce?.reportingMTA },
    ].filter((item) => item.value)
  }

  if (event.event_type === "complaint") {
    const complaint = payload?.complaint || payload?.Complaint || payload?.notification?.complaint || {}
    return [
      { label: "Feedback type", value: complaint?.complaintFeedbackType },
      { label: "Feedback ID", value: complaint?.feedbackId },
      { label: "User agent", value: complaint?.userAgent },
      { label: "Arrival", value: complaint?.arrivalDate },
    ].filter((item) => item.value)
  }

  return []
}

export default function RecipientDrilldownSheet({
  open,
  onOpenChange,
  campaignId,
  recipient,
}: RecipientDrilldownSheetProps) {
  const [events, setEvents] = useState<EmailEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !recipient?.id) return
    const supabase = supabaseBrowser()
    let isActive = true
    setLoading(true)

    supabase
      .from("email_events")
      .select("id,event_type,created_at,payload")
      .eq("campaign_id", campaignId)
      .eq("recipient_id", recipient.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!isActive) return
        if (error) {
          toast({
            variant: "destructive",
            title: "Failed to load recipient activity",
            description: error.message,
          })
          setEvents([])
          return
        }
        setEvents(data || [])
      })
      .finally(() => {
        if (isActive) setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [open, campaignId, recipient?.id])

  const totals = useMemo(() => {
    const totalOpens = events.filter((event) => event.event_type === "open").length
    const clickEvents = events.filter((event) => {
      if (event.event_type !== "click") return false
      const url = getEventUrl(event.payload)
      return !isSystemLink(url)
    })
    const clickUrls = clickEvents.map((event) => getEventUrl(event.payload)).filter(Boolean) as string[]
    const uniqueLinks = new Set(clickUrls).size
    const clickCounts = clickUrls.reduce<Record<string, number>>((acc, url) => {
      acc[url] = (acc[url] || 0) + 1
      return acc
    }, {})

    return {
      totalOpens,
      totalClicks: clickEvents.length,
      uniqueLinks,
      clickCounts,
    }
  }, [events])

  const statusEvents = useMemo(() => {
    const hasEvent = (type: string) => events.some((event) => event.event_type === type)
    const hasUnsub = events.some((event) => event.event_type === "unsubscribe" || event.event_type === "unsub")
    return {
      delivered: hasEvent("delivery"),
      open: hasEvent("open"),
      click: hasEvent("click"),
      bounce: hasEvent("bounce"),
      complaint: hasEvent("complaint"),
      unsubscribe: hasUnsub,
    }
  }, [events])

  const eventTimeline = useMemo(() => {
    return events.map((event) => {
      const url = getEventUrl(event.payload)
      return {
        ...event,
        url,
        isSystemLink: isSystemLink(url),
      }
    })
  }, [events])

  const bounceEvent = events.find((event) => event.event_type === "bounce")
  const complaintEvent = events.find((event) => event.event_type === "complaint")
  const diagnosticDetails = buildDiagnosticDetails(bounceEvent || complaintEvent)
  const clickRows = Object.entries(totals.clickCounts).map(([url, count]) => ({ url, count }))

  const buyerEmail = recipient?.buyer?.email

  const handleCopyEmail = async () => {
    if (!buyerEmail) return
    try {
      await navigator.clipboard.writeText(buyerEmail)
      toast({ title: "Email copied" })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: error instanceof Error ? error.message : "Unable to copy email",
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[640px] p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>{formatName(recipient?.buyer)}</SheetTitle>
          <SheetDescription>
            {buyerEmail ? buyerEmail : "Recipient drilldown"}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-full">
          <div className="px-6 py-5 space-y-6">
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusEvents).map(([key, isActive]) => (
                <Badge
                  key={key}
                  className={statusBadgeStyles[key] || "bg-muted text-muted-foreground"}
                  variant={isActive ? "default" : "secondary"}
                >
                  {key}
                </Badge>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-white p-3">
                <div className="text-xs uppercase text-muted-foreground">Total opens</div>
                <div className="text-2xl font-semibold">{totals.totalOpens}</div>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <div className="text-xs uppercase text-muted-foreground">Total clicks</div>
                <div className="text-2xl font-semibold">{totals.totalClicks}</div>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <div className="text-xs uppercase text-muted-foreground">Unique links</div>
                <div className="text-2xl font-semibold">{totals.uniqueLinks}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleCopyEmail} disabled={!buyerEmail}>
                Copy email
              </Button>
              {recipient?.buyer?.id && (
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/buyers/${recipient.buyer.id}`}>Open buyer</Link>
                </Button>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="text-sm font-semibold">Timeline</div>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading activity…</div>
              ) : eventTimeline.length === 0 ? (
                <div className="text-sm text-muted-foreground">No activity yet.</div>
              ) : (
                <div className="space-y-3">
                  {eventTimeline.map((event) => (
                    <div key={event.id} className="rounded-md border bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={statusBadgeStyles[event.event_type] || "bg-muted text-muted-foreground"}>
                          {formatEventType(event.event_type)}
                        </Badge>
                        {event.isSystemLink && (
                          <Badge variant="secondary">system link</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{formatDate(event.created_at)}</span>
                      </div>
                      {event.url && (
                        <div className="mt-2 text-xs">
                          <Link href={event.url} target="_blank" className="text-blue-600 hover:underline break-all">
                            {event.url}
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="text-sm font-semibold">Click breakdown</div>
              {clickRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No non-system clicks yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead className="w-[120px] text-right">Clicks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clickRows.map((row) => (
                      <TableRow key={row.url}>
                        <TableCell className="max-w-[320px] truncate">
                          <Link href={row.url} className="text-blue-600 hover:underline" target="_blank">
                            {row.url}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {(bounceEvent || complaintEvent) && diagnosticDetails.length > 0 && (
              <Collapsible className="rounded-lg border bg-white">
                <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
                  Details
                  <span className="text-xs text-muted-foreground">Diagnostic info</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4">
                  <div className="space-y-2 text-sm">
                    {diagnosticDetails.map((detail) => (
                      <div key={detail.label} className="flex items-start justify-between gap-4">
                        <span className="text-muted-foreground">{detail.label}</span>
                        <span className="text-right break-all">{detail.value}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
