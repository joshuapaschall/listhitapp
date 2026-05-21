"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts"

const num = (n: number) => new Intl.NumberFormat().format(n || 0)
const pct = (n: number) => `${(n || 0).toFixed(1)}%`

export default function EmailCampaignReport({ analytics }: any) {
  const s = analytics?.summary || {}
  const r = analytics?.rates || {}
  const funnel = [
    { label: "Recipients", value: s.recipients || 0 },
    { label: "Sent", value: s.sent || 0 },
    { label: "Delivered", value: s.delivered || 0 },
    { label: "Opened", value: s.uniqueOpens || 0 },
    { label: "Clicked", value: s.uniqueClicks || 0 },
  ]
  const max = Math.max(...funnel.map((f) => f.value), 1)
  return <Tabs defaultValue="overview" className="space-y-4">
    <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="recipients">Recipients</TabsTrigger><TabsTrigger value="links">Links</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList>
    <TabsContent value="overview" className="space-y-4">
      <Card className="bg-brand-tint"><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Open rate</div><div className="text-6xl font-semibold tabular-nums text-brand">{pct(r.openRate)}</div><div className="text-sm text-muted-foreground">Delivered {num(s.delivered)} of {num(s.sent)} sent</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Funnel</CardTitle></CardHeader><CardContent className="space-y-3">{funnel.map((f, i) => <div key={f.label}><div className="flex justify-between text-sm"><span>{f.label}</span><span className="tabular-nums">{num(f.value)} {i===0?"":`(${pct((f.value/Math.max(funnel[i-1].value,1))*100)})`}</span></div><div className="h-3 rounded bg-muted"><div className="h-3 rounded bg-brand" style={{ width: `${(f.value / max) * 100}%` }} /></div></div>)}</CardContent></Card>
      <Card><CardContent className="pt-6 grid md:grid-cols-4 gap-4 text-sm"><div><div className="text-muted-foreground">Delivered</div><div className="text-2xl tabular-nums">{num(s.delivered)} ({pct(r.deliveryRate)})</div></div><div><div className="text-muted-foreground">Opens</div><div className="text-2xl tabular-nums">{num(s.uniqueOpens)} / {num(s.totalOpens)}</div></div><div><div className="text-muted-foreground">Clicks</div><div className="text-2xl tabular-nums">{num(s.uniqueClicks)} / {num(s.totalClicks)}</div></div><div><div className="text-muted-foreground">Click-to-open</div><div className="text-2xl tabular-nums">{pct(r.clickToOpen)}</div></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Performance over time</CardTitle></CardHeader><CardContent><ChartContainer config={{ opens: { label: "Opens", color: "hsl(var(--chart-2))" }, clicks: { label: "Clicks", color: "hsl(var(--chart-1))" } }} className="h-[280px] w-full"><LineChart data={analytics?.timeline || []}><CartesianGrid vertical={false} /><XAxis dataKey="bucket" hide /><YAxis allowDecimals={false} /><ChartTooltip content={<ChartTooltipContent />} /><Line dataKey="opens" stroke="var(--color-opens)" dot={false} /><Line dataKey="clicks" stroke="var(--color-clicks)" dot={false} /></LineChart></ChartContainer></CardContent></Card>
    </TabsContent>
    <TabsContent value="links"><Card><CardHeader><CardTitle>Top links</CardTitle></CardHeader><CardContent className="space-y-2">{(analytics?.topLinks || []).map((l: any) => <div key={l.url} className="flex justify-between text-sm"><span className="truncate max-w-[70%]" title={l.url}>{l.url}</span><span className="tabular-nums">{num(l.totalClicks)} clicks</span></div>)}</CardContent></Card></TabsContent>
    <TabsContent value="recipients"><Card><CardContent className="pt-6 text-sm">Email delivery lifecycle</CardContent></Card></TabsContent>
    <TabsContent value="activity"><Card><CardContent className="pt-6 text-sm">{(analytics?.recentEvents || []).length} recent events</CardContent></Card></TabsContent>
  </Tabs>
}
