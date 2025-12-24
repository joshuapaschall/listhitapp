"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
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
  })
}

export function CampaignDetailsPanel({ campaign }: { campaign: Campaign }) {
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching } = useCampaignAnalytics(campaign.id)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    const supabase = supabaseBrowser()
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
      }, 500)
    }

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout)
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
          {isFetching && <span className="text-xs text-muted-foreground">Updating…</span>}
        </div>
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Sent", value: summary?.sent },
              { label: "Delivered", value: summary?.delivered },
              {
                label: "Opens",
                value: summary?.uniqueOpens,
                hint: `${formatNumber(summary?.totalOpens || 0)} total`,
              },
              {
                label: "Clicks",
                value: summary?.uniqueClicks,
                hint: `${formatNumber(summary?.totalClicks || 0)} total`,
              },
              { label: "Bounces", value: summary?.bounces },
              { label: "Unsubs", value: summary?.unsubs },
              { label: "Complaints", value: summary?.complaints },
              { label: "Errors", value: summary?.errors },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardHeader className="pb-2">
                  <CardDescription>{kpi.label}</CardDescription>
                  <CardTitle className="text-3xl">{isLoading ? "…" : formatNumber(kpi.value || 0)}</CardTitle>
                  {kpi.hint && <p className="text-xs text-muted-foreground">{kpi.hint}</p>}
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Opens & clicks over time</CardTitle>
              <CardDescription>Hourly buckets</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
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
