"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ExternalLink,
  Inbox,
  MailCheck,
  MousePointerClick,
  RefreshCw,
  ThumbsDown,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Line, LineChart, XAxis, YAxis } from "recharts"
import { supabaseBrowser } from "@/lib/supabase-browser"
import RecipientDrilldownSheet from "@/components/campaigns/RecipientDrilldownSheet"

type Campaign = {
  id: string
  channel: string
  name: string
  subject?: string | null
  message?: string | null
  campaign_recipients: any[]
}

type RecipientBuyer = {
  id: string
  fname?: string | null
  lname?: string | null
  full_name?: string | null
  company?: string | null
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  email?: string | null
}

type Recipient = {
  id: string
  status?: string | null
  email?: string | null
  sent_at?: string | null
  delivered_at?: string | null
  opened_at?: string | null
  clicked_at?: string | null
  bounced_at?: string | null
  unsubscribed_at?: string | null
  complained_at?: string | null
  error?: string | null
  buyer_id?: string | null
  buyer?: RecipientBuyer | null
}

type AnalyticsResponse = {
  summary: {
    sent: number
    delivered: number
    uniqueOpens: number
    totalOpens: number
    uniqueClicks: number
    totalClicks: number
    bounces: number
    bounceBreakdown?: {
      permanent: number
      transient: number
      other: number
    }
    complaints: number
    unsubs: number
    errors: number
    rates: {
      deliveryRate: number
      openRate: number
      ctr: number
      bounceRate: number
      unsubRate: number
      complaintRate: number
      clickToOpen: number
    }
  }
  topLinks: { url: string; totalClicks: number; uniqueClickers: number }[]
  timeline: { bucket: string; opens: number; clicks: number }[]
  recentEvents: {
    at: string
    type: string
    buyerId?: string | null
    recipientEmail?: string | null
    recipientId?: string | null
    url?: string | null
    buyer?: RecipientBuyer | null
  }[]
  recipients: Recipient[]
}

function formatNumber(val: number) {
  return new Intl.NumberFormat().format(val || 0)
}

function formatPercent(val: number) {
  if (Number.isNaN(val)) return "0%"
  return `${val.toFixed(1)}%`
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return value
  }
}

function formatBuyerName(buyer?: RecipientBuyer | null) {
  if (!buyer) return "Unknown recipient"
  const preferredFullName = buyer.full_name || ""
  const fallbackFullName = [buyer.fname, buyer.lname].filter(Boolean).join(" ")
  const legacyFullName = [buyer.first_name, buyer.last_name].filter(Boolean).join(" ")
  return (
    preferredFullName ||
    fallbackFullName ||
    legacyFullName ||
    buyer.email ||
    "Unknown recipient"
  )
}

function useCampaignAnalytics(campaignId: string) {
  return useQuery<AnalyticsResponse>({
    queryKey: ["campaign-analytics", campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/analytics`, { cache: "no-store" })
      if (!res.ok) {
        throw new Error("Failed to load analytics")
      }
      return res.json()
    },
    refetchOnWindowFocus: false,
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
  })
}

export function CampaignDetailsPanel({ campaign }: { campaign: Campaign }) {
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching, isError, error } = useCampaignAnalytics(campaign.id)
  const [activeTab, setActiveTab] = useState("overview")
  const [isLive, setIsLive] = useState(false)
  const [recipientFilter, setRecipientFilter] = useState("all")
  const [recipientSearch, setRecipientSearch] = useState("")
  const [recipientSheetOpen, setRecipientSheetOpen] = useState(false)
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null)
  const [activityFilter, setActivityFilter] = useState("all")
  const [visibleSeries, setVisibleSeries] = useState<string[]>(["opens", "clicks"])

  useEffect(() => {
    const supabase = supabaseBrowser()
    let liveTimeout: ReturnType<typeof setTimeout> | null = null
    const channel = supabase
      .channel(`campaign-analytics-${campaign.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_recipients",
          filter: `campaign_id=eq.${campaign.id}`,
        },
        () => triggerRefresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "email_events",
          filter: `campaign_id=eq.${campaign.id}`,
        },
        () => triggerRefresh(),
      )
      .subscribe()

    let refreshTimeout: ReturnType<typeof setTimeout> | null = null
    function triggerRefresh() {
      if (refreshTimeout) clearTimeout(refreshTimeout)
      refreshTimeout = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["campaign-analytics", campaign.id] })
        setIsLive(true)
        if (liveTimeout) clearTimeout(liveTimeout)
        liveTimeout = setTimeout(() => setIsLive(false), 2000)
      }, 500)
    }

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout)
      if (liveTimeout) clearTimeout(liveTimeout)
      supabase.removeChannel(channel)
    }
  }, [campaign.id, queryClient])

  const summary = data?.summary
  const recipients = useMemo(() => data?.recipients || [], [data?.recipients])
  const recipientsLoading = isLoading
  const timelineData = useMemo(() => {
    const now = new Date()
    now.setMinutes(0, 0, 0)
    const buckets = new Map<string, { opens: number; clicks: number }>()
    ;(data?.timeline || []).forEach((item) => {
      const date = new Date(item.bucket)
      if (Number.isNaN(date.getTime())) return
      date.setMinutes(0, 0, 0)
      const key = date.toISOString()
      const current = buckets.get(key) || { opens: 0, clicks: 0 }
      buckets.set(key, {
        opens: current.opens + (item.opens || 0),
        clicks: current.clicks + (item.clicks || 0),
      })
    })

    return Array.from({ length: 24 }, (_, index) => {
      const bucketDate = new Date(now.getTime() - (23 - index) * 60 * 60 * 1000)
      const key = bucketDate.toISOString()
      const values = buckets.get(key) || { opens: 0, clicks: 0 }
      return {
        bucket: key,
        opens: values.opens,
        clicks: values.clicks,
      }
    })
  }, [data?.timeline])

  const selectedRecipient = useMemo(() => {
    if (!selectedRecipientId) return null
    return recipients.find((recipient) => recipient.id === selectedRecipientId) || null
  }, [recipients, selectedRecipientId])

  const sortedRecentEvents = useMemo(() => {
    const events = [...(data?.recentEvents || [])]
    return events.sort((a, b) => {
      const timeDiff = new Date(b.at).getTime() - new Date(a.at).getTime()
      if (timeDiff !== 0) return timeDiff
      return (a.recipientId || "").localeCompare(b.recipientId || "")
    })
  }, [data?.recentEvents])

  const filteredActivity = useMemo(() => {
    const events = sortedRecentEvents
    if (activityFilter === "all") return events
    if (activityFilter === "deliveries") {
      return events.filter((event) => event.type === "delivery")
    }
    if (activityFilter === "opens") {
      return events.filter((event) => event.type === "open")
    }
    if (activityFilter === "clicks") {
      return events.filter((event) => event.type === "click")
    }
    if (activityFilter === "bounces") {
      return events.filter((event) => event.type === "bounce")
    }
    if (activityFilter === "complaints") {
      return events.filter((event) => event.type === "complaint")
    }
    if (activityFilter === "unsubs") {
      return events.filter((event) => event.type === "unsubscribe" || event.type === "unsub")
    }
    if (activityFilter === "errors") {
      return events.filter((event) => event.type === "error")
    }
    return events
  }, [activityFilter, sortedRecentEvents])

  const recipientsByBuyerId = useMemo(() => {
    const lookup = new Map<string, Recipient>()
    recipients.forEach((recipient) => {
      if (recipient.buyer_id) {
        lookup.set(recipient.buyer_id, recipient)
      }
    })
    return lookup
  }, [recipients])

  const handleOpenRecipient = (recipientId?: string | null, buyerId?: string | null) => {
    const resolvedId = recipientId || (buyerId ? recipientsByBuyerId.get(buyerId)?.id : null)
    if (!resolvedId) return
    setSelectedRecipientId(resolvedId)
    setRecipientSheetOpen(true)
  }

  const statusBadge = (type: string) => {
    const colors: Record<string, string> = {
      delivered: "bg-emerald-100 text-emerald-800",
      open: "bg-blue-100 text-blue-800",
      click: "bg-indigo-100 text-indigo-800",
      bounce: "bg-amber-100 text-amber-800",
      complaint: "bg-rose-100 text-rose-800",
      unsubscribe: "bg-slate-100 text-slate-800",
      unsub: "bg-slate-100 text-slate-800",
      error: "bg-rose-100 text-rose-800",
    }
    return colors[type] || "bg-muted text-muted-foreground"
  }

  const baseSent = summary?.sent || 0
  const baseDelivered = summary?.delivered || 0
  const uniqueOpens = summary?.uniqueOpens || 0
  const uniqueClicks = summary?.uniqueClicks || 0
  const bounces = summary?.bounces || 0
  const complaints = summary?.complaints || 0
  const unsubs = summary?.unsubs || 0
  const errors = summary?.errors || 0

  const computedRates = {
    deliveryRate: summary?.rates?.deliveryRate ?? (baseSent ? (baseDelivered / baseSent) * 100 : 0),
    openRate: summary?.rates?.openRate ?? (baseSent ? (uniqueOpens / baseSent) * 100 : 0),
    ctr: summary?.rates?.ctr ?? (baseSent ? (uniqueClicks / baseSent) * 100 : 0),
    bounceRate: summary?.rates?.bounceRate ?? (baseSent ? (bounces / baseSent) * 100 : 0),
    complaintRate: summary?.rates?.complaintRate ?? (baseSent ? (complaints / baseSent) * 100 : 0),
    unsubRate: summary?.rates?.unsubRate ?? (baseSent ? (unsubs / baseSent) * 100 : 0),
    errorRate: baseSent ? (errors / baseSent) * 100 : 0,
  }

  const statCards = [
    {
      label: "Sent",
      value: summary?.sent,
      icon: <Inbox className="h-4 w-4 text-muted-foreground" />,
      tone: "bg-white",
      rateLabel: formatPercent(baseSent ? 100 : 0),
      rateFormula: "sent / sent",
      recipientFilter: "all",
    },
    {
      label: "Delivered",
      value: summary?.delivered,
      icon: <MailCheck className="h-4 w-4 text-emerald-600" />,
      tone: "bg-emerald-50 border border-emerald-100",
      rateLabel: formatPercent(computedRates.deliveryRate),
      rateFormula: "delivered / sent",
      recipientFilter: "delivered",
      activityFilter: "deliveries",
    },
    {
      label: "Opens",
      value: uniqueOpens,
      icon: <CheckCircle2 className="h-4 w-4 text-blue-600" />,
      tone: "bg-blue-50 border border-blue-100",
      rateLabel: formatPercent(computedRates.openRate),
      rateFormula: "unique opens / sent",
      recipientFilter: "opened",
      activityFilter: "opens",
      sublabel: `${formatNumber(summary?.totalOpens || 0)} total opens`,
    },
    {
      label: "Clicks",
      value: uniqueClicks,
      icon: <MousePointerClick className="h-4 w-4 text-indigo-600" />,
      tone: "bg-indigo-50 border border-indigo-100",
      rateLabel: formatPercent(computedRates.ctr),
      rateFormula: "unique clicks / sent",
      recipientFilter: "clicked",
      activityFilter: "clicks",
      sublabel: `${formatNumber(summary?.totalClicks || 0)} total clicks`,
    },
    {
      label: "Unsubscribes",
      value: unsubs,
      icon: <ThumbsDown className="h-4 w-4 text-amber-600" />,
      tone: "bg-amber-50 border border-amber-100",
      rateLabel: formatPercent(computedRates.unsubRate),
      rateFormula: "unsubscribes / sent",
      recipientFilter: "unsubscribed",
      activityFilter: "unsubs",
    },
    {
      label: "Bounces",
      value: bounces,
      icon: <XCircle className="h-4 w-4 text-rose-600" />,
      tone: "bg-rose-50 border border-rose-100",
      rateLabel: formatPercent(computedRates.bounceRate),
      rateFormula: "bounces / sent",
      recipientFilter: "bounced",
      activityFilter: "bounces",
      sublabel:
        summary?.bounceBreakdown &&
        `Permanent ${formatNumber(summary.bounceBreakdown.permanent)} · Transient ${formatNumber(summary.bounceBreakdown.transient)}${summary.bounceBreakdown.other ? ` · Other ${formatNumber(summary.bounceBreakdown.other)}` : ""}`,
    },
    {
      label: "Complaints",
      value: complaints,
      icon: <Bell className="h-4 w-4 text-orange-600" />,
      tone: "bg-orange-50 border border-orange-100",
      rateLabel: formatPercent(computedRates.complaintRate),
      rateFormula: "complaints / sent",
      recipientFilter: "complained",
      activityFilter: "complaints",
    },
    {
      label: "Errors",
      value: errors,
      icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
      tone: "bg-red-50 border border-red-100",
      rateLabel: formatPercent(computedRates.errorRate),
      rateFormula: "errors / sent",
      recipientFilter: "errors",
      activityFilter: "errors",
    },
  ]

  const recipientFilters = [
    { value: "all", label: "All" },
    { value: "delivered", label: "Delivered" },
    { value: "opened", label: "Opened" },
    { value: "clicked", label: "Clicked" },
    { value: "bounced", label: "Bounced" },
    { value: "complained", label: "Complained" },
    { value: "unsubscribed", label: "Unsubscribed" },
    { value: "errors", label: "Errors" },
  ]

  const filteredRecipients = useMemo(() => {
    const query = recipientSearch.trim().toLowerCase()
    return recipients.filter((recipient) => {
      if (recipientFilter === "delivered" && !recipient.delivered_at) return false
      if (recipientFilter === "opened" && !recipient.opened_at) return false
      if (recipientFilter === "clicked" && !recipient.clicked_at) return false
      if (recipientFilter === "bounced" && !recipient.bounced_at) return false
      if (recipientFilter === "complained" && !recipient.complained_at) return false
      if (recipientFilter === "unsubscribed" && !recipient.unsubscribed_at) return false
      if (recipientFilter === "errors" && !recipient.error) return false
      if (!query) return true
      const buyer = recipient.buyer
      const haystack = [
        buyer?.full_name,
        buyer?.fname,
        buyer?.lname,
        buyer?.first_name,
        buyer?.last_name,
        buyer?.company,
        buyer?.company_name,
        buyer?.email,
        recipient.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [recipientFilter, recipientSearch, recipients])

  const handleKpiRecipientsView = (filter: string) => {
    setRecipientFilter(filter)
    setActiveTab("recipients")
  }

  const handleKpiEventsView = (filter: string) => {
    setActivityFilter(filter)
    setActiveTab("activity")
  }

  const formatBucketTick = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return date.toLocaleTimeString([], { hour: "numeric" })
  }

  const formatBucketLabel = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="bg-muted/60 p-4 rounded-b-md border-t">
      {isError && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <div className="font-medium">Analytics unavailable</div>
          <div>
            {error instanceof Error ? error.message : "Unable to load campaign analytics."}
          </div>
        </div>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="recipients">Recipients</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {isFetching && (
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Syncing…
              </span>
            )}
            <span className={`flex items-center gap-1 ${isLive ? "text-emerald-600" : ""}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
              Live updates
            </span>
          </div>
        </div>
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((kpi) => (
              <Card
                key={kpi.label}
                className={`${kpi.tone || ""} shadow-sm cursor-pointer transition hover:shadow-md`}
                onClick={() => handleKpiRecipientsView(kpi.recipientFilter)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    handleKpiRecipientsView(kpi.recipientFilter)
                  }
                }}
              >
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
                  <div>
                    <CardDescription className="flex items-center gap-2">
                      {kpi.icon}
                      {kpi.label}
                    </CardDescription>
                    <CardTitle className="text-3xl mt-2">{isLoading ? "…" : formatNumber(kpi.value || 0)}</CardTitle>
                    <p className="text-xs text-muted-foreground" title={kpi.rateFormula}>
                      {kpi.rateLabel}
                    </p>
                    {kpi.sublabel && <p className="text-xs text-muted-foreground">{kpi.sublabel}</p>}
                    {kpi.activityFilter && (
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline mt-2"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleKpiEventsView(kpi.activityFilter)
                        }}
                      >
                        View events instead
                      </button>
                    )}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Engagement rates</CardTitle>
              <CardDescription>Calculated from unique recipients</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Delivery rate", value: summary?.rates?.deliveryRate },
                { label: "Open rate", value: summary?.rates?.openRate },
                { label: "CTR", value: summary?.rates?.ctr },
                { label: "Click-to-open", value: summary?.rates?.clickToOpen },
                { label: "Bounce rate", value: summary?.rates?.bounceRate },
                { label: "Unsub rate", value: summary?.rates?.unsubRate },
                { label: "Complaint rate", value: summary?.rates?.complaintRate },
              ].map((rate) => (
                <div key={rate.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{rate.label}</span>
                    <span>{isLoading ? "…" : formatPercent(rate.value || 0)}</span>
                  </div>
                  <Progress value={Math.min(100, Math.max(0, rate.value || 0))} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Performance over time</CardTitle>
                    <CardDescription>Hourly buckets via campaign_event_timeline()</CardDescription>
                  </div>
                  <ToggleGroup
                    type="multiple"
                    value={visibleSeries}
                    onValueChange={(value) => setVisibleSeries(value)}
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    <ToggleGroupItem value="opens" aria-label="Toggle opens">
                      Opens
                    </ToggleGroupItem>
                    <ToggleGroupItem value="clicks" aria-label="Toggle clicks">
                      Clicks
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardHeader>
              <CardContent className="h-80">
                {isLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading chart…</div>
                ) : (
                  <ChartContainer
                    config={{
                      opens: { label: "Opens", color: "hsl(var(--chart-2))" },
                      clicks: { label: "Clicks", color: "hsl(var(--chart-1))" },
                    }}
                    className="h-full"
                  >
                    <LineChart data={timelineData}>
                      <XAxis dataKey="bucket" tickFormatter={formatBucketTick} />
                      <YAxis allowDecimals={false} domain={[0, "dataMax"]} />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        labelFormatter={formatBucketLabel}
                      />
                      {visibleSeries.includes("opens") && (
                        <Line
                          type="monotone"
                          dataKey="opens"
                          stroke="var(--color-opens)"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      )}
                      {visibleSeries.includes("clicks") && (
                        <Line
                          type="monotone"
                          dataKey="clicks"
                          stroke="var(--color-clicks)"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      )}
                      <ChartLegend content={<ChartLegendContent />} />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Top links</CardTitle>
                <CardDescription>campaign_top_links()</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.topLinks?.length ? (
                  data.topLinks.slice(0, 5).map((link) => (
                    <div key={link.url} className="flex items-start justify-between gap-3 rounded-md border p-3">
                      <div className="space-y-1">
                        <Link href={link.url} className="text-sm text-blue-600 hover:underline break-all" target="_blank">
                          {link.url}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(link.uniqueClickers)} unique · {formatNumber(link.totalClicks)} total
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {isLoading ? "Loading links…" : "No link activity yet."}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Full breakdown available in the Links tab.
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent activity</CardTitle>
              <CardDescription>Live feed from campaign_recent_events()</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sortedRecentEvents.length ? (
                sortedRecentEvents.slice(0, 8).map((evt, idx) => {
                  const recipientName = evt.buyer ? formatBuyerName(evt.buyer) : evt.recipientEmail || "Unknown recipient"
                  const recipientEmail = evt.buyer?.email || evt.recipientEmail
                  return (
                    <div key={`${evt.at}-${idx}`} className="flex items-start gap-3 rounded-md border p-3 bg-white">
                      <Badge className={statusBadge(evt.type)}>{evt.type}</Badge>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{recipientName}</div>
                        {recipientEmail && <div className="text-xs text-muted-foreground">{recipientEmail}</div>}
                        <div className="text-xs text-muted-foreground">{formatDate(evt.at)}</div>
                        {evt.url && (
                          <div className="text-xs">
                            <Link href={evt.url} className="text-blue-600 hover:underline" target="_blank">
                              {evt.url}
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-sm text-muted-foreground">
                  {isLoading ? "Loading activity…" : "No events yet."}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                See the Activity tab for the full log.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipients" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recipients</CardTitle>
              <CardDescription>Email delivery lifecycle</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pb-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap gap-2">
                  {recipientFilters.map((filter) => (
                    <Button
                      key={filter.value}
                      size="sm"
                      variant={recipientFilter === filter.value ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => setRecipientFilter(filter.value)}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
                <div className="w-full sm:w-[240px]">
                  <Input
                    placeholder="Search name or email"
                    value={recipientSearch}
                    onChange={(event) => setRecipientSearch(event.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Delivered</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Clicked</TableHead>
                    <TableHead>Bounced</TableHead>
                    <TableHead>Unsub</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipientsLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={`recipient-skeleton-${index}`}>
                        {Array.from({ length: 9 }).map((__, cellIndex) => (
                          <TableCell key={`recipient-skeleton-cell-${index}-${cellIndex}`}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : isError ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-sm text-destructive">
                        {error instanceof Error ? error.message : "Unable to load recipients."}
                      </TableCell>
                    </TableRow>
                  ) : filteredRecipients.length > 0 ? (
                    filteredRecipients.map((recipient) => (
                      <TableRow
                        key={recipient.id}
                        className="cursor-pointer hover:bg-muted/60"
                        onClick={() => handleOpenRecipient(recipient.id, recipient.buyer_id)}
                      >
                        <TableCell>
                          <div className="text-sm font-medium">{formatBuyerName(recipient.buyer)}</div>
                          <div className="text-xs text-muted-foreground">{recipient.buyer?.email || recipient.email || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {recipient.status || "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {formatDate(recipient.sent_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {formatDate(recipient.delivered_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {formatDate(recipient.opened_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {formatDate(recipient.clicked_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {formatDate(recipient.bounced_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {formatDate(recipient.unsubscribed_at)}
                        </TableCell>
                        <TableCell className="text-xs text-red-700">{recipient.error || "-"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-sm text-muted-foreground">
                        No recipients yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Top links</CardTitle>
              <CardDescription>Clicks per destination</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Total clicks</TableHead>
                    <TableHead>Unique clickers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.topLinks?.length ? (
                    data.topLinks.map((link) => (
                      <TableRow key={link.url}>
                        <TableCell className="max-w-[420px] truncate">
                          <Link href={link.url} className="text-blue-600 hover:underline" target="_blank">
                            {link.url}
                          </Link>
                        </TableCell>
                        <TableCell>{formatNumber(link.totalClicks)}</TableCell>
                        <TableCell>{formatNumber(link.uniqueClickers)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-sm text-muted-foreground">
                        {isLoading ? "Loading..." : "No link activity yet."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent activity</CardTitle>
              <CardDescription>Latest 50 events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "deliveries", label: "Deliveries" },
                  { value: "opens", label: "Opens" },
                  { value: "clicks", label: "Clicks" },
                  { value: "bounces", label: "Bounces" },
                  { value: "complaints", label: "Complaints" },
                  { value: "unsubs", label: "Unsubs" },
                  { value: "errors", label: "Errors" },
                ].map((filter) => (
                  <Button
                    key={filter.value}
                    size="sm"
                    variant={activityFilter === filter.value ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setActivityFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
              {filteredActivity.length ? (
                filteredActivity.map((evt, idx) => {
                  const recipientName = evt.buyer ? formatBuyerName(evt.buyer) : evt.recipientEmail || "Unknown recipient"
                  const recipientEmail = evt.buyer?.email || evt.recipientEmail
                  const resolvedRecipientId = evt.recipientId || (evt.buyerId ? recipientsByBuyerId.get(evt.buyerId)?.id : null)
                  const isClickable = Boolean(resolvedRecipientId)
                  return (
                    <div
                      key={`${evt.at}-${idx}`}
                      className={`flex items-start gap-3 rounded-md border p-3 ${isClickable ? "cursor-pointer hover:bg-muted/60" : ""}`}
                      onClick={() => handleOpenRecipient(resolvedRecipientId, evt.buyerId)}
                    >
                      <Badge className={statusBadge(evt.type)}>{evt.type}</Badge>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{recipientName}</div>
                        {recipientEmail && <div className="text-xs text-muted-foreground">{recipientEmail}</div>}
                        <div className="text-xs text-muted-foreground">{formatDate(evt.at)}</div>
                        {evt.url && (
                          <div className="text-xs">
                            <Link href={evt.url} className="text-blue-600 hover:underline" target="_blank">
                              {evt.url}
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-sm text-muted-foreground">
                  {isLoading ? "Loading activity…" : "No events yet."}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Separator className="mt-6" />
      <div className="text-xs text-muted-foreground mt-2">Realtime updates via Supabase Live.</div>
      <RecipientDrilldownSheet
        open={recipientSheetOpen}
        onOpenChange={setRecipientSheetOpen}
        campaignId={campaign.id}
        recipient={selectedRecipient}
      />
    </div>
  )
}

export default CampaignDetailsPanel
