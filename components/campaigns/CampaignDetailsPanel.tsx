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
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
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
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

type Recipient = {
  id: string
  status?: string | null
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
    recipientEmail?: string | null
    recipientId?: string | null
    url?: string | null
    buyer?: RecipientBuyer | null
  }[]
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
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function formatBuyerName(buyer?: RecipientBuyer | null) {
  if (!buyer) return "Unknown recipient"
  const fullName = [buyer.first_name, buyer.last_name].filter(Boolean).join(" ")
  return fullName || buyer.email || "Unknown recipient"
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
  const { data, isLoading, isFetching } = useCampaignAnalytics(campaign.id)
  const [activeTab, setActiveTab] = useState("overview")
  const [isLive, setIsLive] = useState(false)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [recipientsLoading, setRecipientsLoading] = useState(false)
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

  useEffect(() => {
    const supabase = supabaseBrowser()
    let isActive = true

    const fetchRecipients = async () => {
      setRecipientsLoading(true)
      const { data: recipientsData, error } = await supabase
        .from("campaign_recipients")
        .select(
          "id,status,sent_at,delivered_at,opened_at,clicked_at,bounced_at,unsubscribed_at,complained_at,error,buyer_id,buyer:buyers(id,first_name,last_name,email)",
        )
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: true })

      if (!isActive) return

      if (error) {
        console.error("Failed to fetch recipients", error)
        setRecipients([])
      } else {
        setRecipients((recipientsData || []) as Recipient[])
      }
      setRecipientsLoading(false)
    }

    const hydrateRecipient = async (recipientId: string) => {
      const { data: row, error } = await supabase
        .from("campaign_recipients")
        .select(
          "id,status,sent_at,delivered_at,opened_at,clicked_at,bounced_at,unsubscribed_at,complained_at,error,buyer_id,buyer:buyers(id,first_name,last_name,email)",
        )
        .eq("id", recipientId)
        .maybeSingle()
      if (error || !row) return null
      return row as Recipient
    }

    fetchRecipients()

    const channel = supabase
      .channel(`campaign-recipients-${campaign.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_recipients",
          filter: `campaign_id=eq.${campaign.id}`,
        },
        async (payload) => {
          if (!isActive) return
          if (payload.eventType === "DELETE") {
            setRecipients((prev) => prev.filter((item) => item.id !== payload.old?.id))
            return
          }
          const recordId = payload.new?.id
          if (!recordId) return
          const updatedRecipient = await hydrateRecipient(recordId)
          if (!updatedRecipient) return
          setRecipients((prev) => {
            const existingIndex = prev.findIndex((item) => item.id === updatedRecipient.id)
            if (existingIndex >= 0) {
              const next = [...prev]
              next[existingIndex] = updatedRecipient
              return next
            }
            return [...prev, updatedRecipient]
          })
        },
      )
      .subscribe()

    return () => {
      isActive = false
      supabase.removeChannel(channel)
    }
  }, [campaign.id])

  const summary = data?.summary
  const timelineData = useMemo(() => {
    if (!data?.timeline) return []
    return data.timeline.map((item) => {
      const ts = new Date(item.bucket).getTime()
      return {
        ts,
        label: new Date(item.bucket).toLocaleString(undefined, {
          hour: "numeric",
          minute: "2-digit",
          month: "short",
          day: "numeric",
        }),
        opens: item.opens,
        clicks: item.clicks,
      }
    })
  }, [data?.timeline])

  const selectedRecipient = useMemo(() => {
    if (!selectedRecipientId) return null
    return recipients.find((recipient) => recipient.id === selectedRecipientId) || null
  }, [recipients, selectedRecipientId])

  const filteredActivity = useMemo(() => {
    const events = data?.recentEvents || []
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
    return events
  }, [activityFilter, data?.recentEvents])

  const handleOpenRecipient = (recipientId?: string | null) => {
    if (!recipientId) return
    setSelectedRecipientId(recipientId)
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

  const statCards = [
    {
      label: "Sent",
      value: summary?.sent,
      icon: <Inbox className="h-4 w-4 text-muted-foreground" />,
      tone: "bg-white",
    },
    {
      label: "Delivered",
      value: summary?.delivered,
      icon: <MailCheck className="h-4 w-4 text-emerald-600" />,
      tone: "bg-emerald-50 border border-emerald-100",
      sublabel: `${formatPercent(summary?.rates?.deliveryRate || 0)} delivery`,
    },
    {
      label: "Opens",
      value: summary?.uniqueOpens,
      icon: <CheckCircle2 className="h-4 w-4 text-blue-600" />,
      tone: "bg-blue-50 border border-blue-100",
      sublabel: `${formatNumber(summary?.totalOpens || 0)} total opens`,
    },
    {
      label: "Clicks",
      value: summary?.uniqueClicks,
      icon: <MousePointerClick className="h-4 w-4 text-indigo-600" />,
      tone: "bg-indigo-50 border border-indigo-100",
      sublabel: `${formatNumber(summary?.totalClicks || 0)} total clicks`,
    },
    {
      label: "Unsubscribes",
      value: summary?.unsubs,
      icon: <ThumbsDown className="h-4 w-4 text-amber-600" />,
      tone: "bg-amber-50 border border-amber-100",
    },
    {
      label: "Bounces",
      value: summary?.bounces,
      icon: <XCircle className="h-4 w-4 text-rose-600" />,
      tone: "bg-rose-50 border border-rose-100",
      sublabel:
        summary?.bounceBreakdown &&
        `Permanent ${formatNumber(summary.bounceBreakdown.permanent)} · Transient ${formatNumber(summary.bounceBreakdown.transient)}${summary.bounceBreakdown.other ? ` · Other ${formatNumber(summary.bounceBreakdown.other)}` : ""}`,
    },
    {
      label: "Complaints",
      value: summary?.complaints,
      icon: <Bell className="h-4 w-4 text-orange-600" />,
      tone: "bg-orange-50 border border-orange-100",
    },
    {
      label: "Errors",
      value: summary?.errors,
      icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
      tone: "bg-red-50 border border-red-100",
    },
  ]

  return (
    <div className="bg-muted/60 p-4 rounded-b-md border-t">
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
              <Card key={kpi.label} className={`${kpi.tone || ""} shadow-sm`}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
                  <div>
                    <CardDescription className="flex items-center gap-2">
                      {kpi.icon}
                      {kpi.label}
                    </CardDescription>
                    <CardTitle className="text-3xl mt-2">{isLoading ? "…" : formatNumber(kpi.value || 0)}</CardTitle>
                    {kpi.sublabel && <p className="text-xs text-muted-foreground">{kpi.sublabel}</p>}
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
                ) : timelineData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No activity yet.
                  </div>
                ) : (
                  <ChartContainer
                    config={{
                      opens: { label: "Opens", color: "hsl(var(--chart-2))" },
                      clicks: { label: "Clicks", color: "hsl(var(--chart-1))" },
                    }}
                    className="h-full"
                  >
                    <LineChart data={timelineData}>
                      <XAxis
                        dataKey="ts"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        labelFormatter={(value) =>
                          new Date(Number(value)).toLocaleString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                            month: "short",
                            day: "numeric",
                          })
                        }
                      />
                      {visibleSeries.includes("opens") && (
                        <Line type="monotone" dataKey="opens" stroke="var(--color-opens)" strokeWidth={2} dot={false} />
                      )}
                      {visibleSeries.includes("clicks") && (
                        <Line type="monotone" dataKey="clicks" stroke="var(--color-clicks)" strokeWidth={2} dot={false} />
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
              {data?.recentEvents?.length ? (
                data.recentEvents.slice(0, 8).map((evt, idx) => {
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
                  {recipients.length > 0 ? (
                    recipients.map((recipient) => (
                      <TableRow
                        key={recipient.id}
                        className="cursor-pointer hover:bg-muted/60"
                        onClick={() => handleOpenRecipient(recipient.id)}
                      >
                        <TableCell>
                          <div className="text-sm font-medium">{formatBuyerName(recipient.buyer)}</div>
                          <div className="text-xs text-muted-foreground">{recipient.buyer?.email || "-"}</div>
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
                        {recipientsLoading ? "Loading recipients…" : "No recipients yet."}
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
                  const isClickable = Boolean(evt.recipientId)
                  return (
                    <div
                      key={`${evt.at}-${idx}`}
                      className={`flex items-start gap-3 rounded-md border p-3 ${isClickable ? "cursor-pointer hover:bg-muted/60" : ""}`}
                      onClick={() => handleOpenRecipient(evt.recipientId)}
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
