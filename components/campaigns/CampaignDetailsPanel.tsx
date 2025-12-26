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
import { Line, LineChart, XAxis, YAxis } from "recharts"
import { supabaseBrowser } from "@/lib/supabase-browser"

type Campaign = {
  id: string
  channel: string
  name: string
  subject?: string | null
  message?: string | null
  campaign_recipients: any[]
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
  recentEvents: { at: string; type: string; recipientEmail?: string | null; url?: string | null }[]
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
  const timelineData = useMemo(() => {
    if (!data?.timeline) return []
    return data.timeline.map((item) => ({
      bucket: new Date(item.bucket).toLocaleString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      }),
      opens: item.opens,
      clicks: item.clicks,
    }))
  }, [data?.timeline])

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
                <CardTitle className="text-lg">Performance over time</CardTitle>
                <CardDescription>Hourly buckets via campaign_event_timeline()</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {isLoading ? (
                  <div className="text-sm text-muted-foreground">Loading chart…</div>
                ) : timelineData.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No activity yet.</div>
                ) : (
                  <ChartContainer
                    config={{
                      opens: { label: "Opens", color: "hsl(var(--chart-2))" },
                      clicks: { label: "Clicks", color: "hsl(var(--chart-1))" },
                    }}
                    className="h-full"
                  >
                    <LineChart data={timelineData}>
                      <XAxis dataKey="bucket" />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="opens" stroke="var(--color-opens)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="clicks" stroke="var(--color-clicks)" strokeWidth={2} dot={false} />
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
                data.recentEvents.slice(0, 8).map((evt, idx) => (
                  <div key={`${evt.at}-${idx}`} className="flex items-start gap-3 rounded-md border p-3 bg-white">
                    <Badge className={statusBadge(evt.type)}>{evt.type}</Badge>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{evt.recipientEmail || "Unknown recipient"}</div>
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
                ))
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
                  {campaign.campaign_recipients?.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">
                        {r.buyers?.full_name ||
                          `${r.buyers?.fname || ""} ${r.buyers?.lname || ""}`.trim() ||
                          r.buyer_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {r.status || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatDate(r.sent_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatDate(r.delivered_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatDate(r.opened_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatDate(r.clicked_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatDate(r.bounced_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatDate(r.unsubscribed_at)}
                      </TableCell>
                      <TableCell className="text-xs text-red-700">{r.error || "-"}</TableCell>
                    </TableRow>
                  ))}
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
            <CardContent className="space-y-3">
              {data?.recentEvents?.length ? (
                data.recentEvents.map((evt, idx) => (
                  <div key={`${evt.at}-${idx}`} className="flex items-start gap-3">
                    <Badge className={statusBadge(evt.type)}>{evt.type}</Badge>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{evt.recipientEmail || "Unknown recipient"}</div>
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
                ))
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
    </div>
  )
}

export default CampaignDetailsPanel
