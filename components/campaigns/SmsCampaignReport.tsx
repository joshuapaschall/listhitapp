"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

const num = (n: number) => new Intl.NumberFormat().format(n || 0)
const pct = (n: number) => `${(n || 0).toFixed(1)}%`
const usd = (n: number) => (Math.abs(n) >= 1 ? `$${(n || 0).toFixed(2)}` : `$${(n || 0).toFixed(4)}`)

export default function SmsCampaignReport({ analytics }: any) {
  const s = analytics?.summary || {}
  const r = analytics?.rates || {}
  const funnel = [{ label: "Recipients", value: s.total || 0 }, { label: "Sent", value: s.sent || 0 }, { label: "Delivered", value: s.delivered || 0 }, { label: "Clicked", value: s.clicked || 0 }, { label: "Replied", value: s.replied || 0 }]
  const max = Math.max(...funnel.map((f) => f.value), 1)
  return <Tabs defaultValue="overview" className="space-y-4">
    <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="recipients">Recipients</TabsTrigger><TabsTrigger value="links">Links</TabsTrigger></TabsList>
    <TabsContent value="overview" className="space-y-4">
      <Card className="bg-brand-tint"><CardContent className="pt-6 grid md:grid-cols-2 gap-4"><div><div className="text-sm text-muted-foreground">Delivery rate</div><div className="text-6xl font-semibold tabular-nums text-brand">{pct(r.deliveryRate)}</div><div className="text-sm text-muted-foreground">{num(s.delivered)} delivered / {num(s.sent)} sent</div></div><div><div className="text-sm text-muted-foreground">Reply rate</div><div className="text-4xl font-semibold tabular-nums">{pct(r.replyRate)}</div></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Funnel</CardTitle></CardHeader><CardContent className="space-y-3">{funnel.map((f, i) => <div key={f.label}><div className="flex justify-between text-sm"><span>{f.label}</span><span className="tabular-nums">{num(f.value)} {i===0?"":`(${pct((f.value/Math.max(funnel[i-1].value,1))*100)})`}</span></div><div className="h-3 rounded bg-muted"><div className="h-3 rounded bg-brand" style={{ width: `${(f.value / max) * 100}%` }} /></div></div>)}</CardContent></Card>
      <Card><CardContent className="pt-6 grid md:grid-cols-3 gap-4 text-sm"><div>Sent <div className="text-2xl tabular-nums">{num(s.sent)}</div></div><div>Delivered <div className="text-2xl tabular-nums">{num(s.delivered)} ({pct(r.deliveryRate)})</div></div><div className="text-destructive">Failed/Undelivered <div className="text-2xl tabular-nums">{num((s.failed||0)+(s.undelivered||0))} ({pct(r.failureRate)})</div></div><div>Clicks <div className="text-2xl tabular-nums">{num(s.clicked)} ({pct(r.clickRate)})</div></div><div>Replies <div className="text-2xl tabular-nums">{num(s.replied)} ({pct(r.replyRate)})</div></div><div className="text-amber-600">Opt-outs <div className="text-2xl tabular-nums">{num(s.opted_out)} ({pct(r.optOutRate)})</div></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Cost</CardTitle></CardHeader><CardContent className="grid md:grid-cols-4 gap-3 text-sm tabular-nums"><div>Total cost<div className="text-xl">{usd(s.total_cost_usd)}</div></div><div>Cost per message<div className="text-xl">{usd(r.costPerMessage)}</div></div><div>Total segments<div className="text-xl">{num(s.total_segments)}</div></div><div>Avg segments<div className="text-xl">{Number(s.avg_segments||0).toFixed(2)}</div></div><div className="md:col-span-4 text-muted-foreground">Billed by Telnyx on message finalization.</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Performance over time</CardTitle></CardHeader><CardContent><ChartContainer config={{ delivered: { label: "Delivered", color: "hsl(var(--chart-2))" }, clicked: { label: "Clicked", color: "hsl(var(--chart-1))" }, replied: { label: "Replied", color: "hsl(var(--chart-4))" } }} className="h-[280px] w-full"><LineChart data={analytics?.timeline || []}><CartesianGrid vertical={false} /><XAxis dataKey="bucket" hide /><YAxis allowDecimals={false} /><ChartTooltip content={<ChartTooltipContent />} /><Line dataKey="delivered" stroke="var(--color-delivered)" dot={false} /><Line dataKey="clicked" stroke="var(--color-clicked)" dot={false} /><Line dataKey="replied" stroke="var(--color-replied)" dot={false} /></LineChart></ChartContainer></CardContent></Card>
    </TabsContent>
    <TabsContent value="links"><Card><CardHeader><CardTitle>Top links</CardTitle></CardHeader><CardContent className="space-y-2">{(analytics?.topLinks || []).map((l: any) => <div key={l.url} className="flex justify-between text-sm"><span className="truncate max-w-[65%]" title={l.url}>{l.url}</span><span className="tabular-nums">{num(l.totalClicks)} / {num(l.uniqueClickers)}</span></div>)}</CardContent></Card></TabsContent>
    <TabsContent value="recipients"><Card><CardContent className="pt-6 text-sm">SMS delivery lifecycle</CardContent></Card></TabsContent>
  </Tabs>
}
