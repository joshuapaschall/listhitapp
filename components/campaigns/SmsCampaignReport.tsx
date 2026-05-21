"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts"
import { AlertTriangle, CheckCircle2, Link2, MessageCircle, MousePointerClick, Send, ShieldAlert, TrendingUp } from "lucide-react"
import { useState } from "react"
import CampaignRecipientsTable from "./CampaignRecipientsTable"
import SmsRecipientDrilldownSheet from "./SmsRecipientDrilldownSheet"

const num = (n: number) => new Intl.NumberFormat().format(n || 0)
const pct = (n: number) => `${(n || 0).toFixed(1)}%`
const usd = (n: number) => (Math.abs(n) >= 1 ? `$${(n || 0).toFixed(2)}` : `$${(n || 0).toFixed(4)}`)

export default function SmsCampaignReport({ campaign, analytics }: any) {
  const s = analytics?.summary || {}
  const r = analytics?.rates || {}
  const timeline = analytics?.timeline || []
  const topLinks = analytics?.topLinks || []
  const [selected, setSelected] = useState<any | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const funnel = [
    { label: "Recipients", value: s.total || 0 },
    { label: "Sent", value: s.sent || 0 },
    { label: "Delivered", value: s.delivered || 0 },
    { label: "Clicked", value: s.clicked || 0 },
    { label: "Replied", value: s.replied || 0 },
  ]
  const max = Math.max(...funnel.map((f: any) => f.value), 1)
  const topClicks = Math.max(...topLinks.map((l: any) => l.totalClicks || 0), 1)

  return <Tabs defaultValue="overview" className="space-y-5">
    <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="recipients">Recipients</TabsTrigger><TabsTrigger value="links">Links</TabsTrigger></TabsList>
    <TabsContent value="overview" className="space-y-5">
      <Card className="overflow-hidden border-brand/20 bg-brand-tint dark:bg-brand/10">
        <CardContent className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Primary KPI</p>
            <p className="mt-2 text-sm text-muted-foreground">Delivery rate</p>
            <p className="text-5xl font-semibold tabular-nums text-brand md:text-6xl">{pct(r.deliveryRate)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{num(s.delivered)} delivered of {num(s.sent)} sent</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <div className="rounded-xl border border-brand/20 bg-white/70 p-3 dark:bg-brand/15"><p className="text-xs uppercase tracking-wide text-muted-foreground">Reply rate</p><p className="mt-1 text-2xl font-semibold tabular-nums text-brand">{pct(r.replyRate)}</p></div>
            <div className="rounded-xl border border-brand/20 bg-white/70 p-3 dark:bg-brand/15"><p className="text-xs uppercase tracking-wide text-muted-foreground">Click rate</p><p className="mt-1 text-2xl font-semibold tabular-nums text-brand">{pct(r.clickRate)}</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Sent", value: num(s.sent), badge: null, icon: Send, tone: "text-foreground" },
          { label: "Delivered", value: num(s.delivered), badge: pct(r.deliveryRate), icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" },
          { label: "Failed / Undelivered", value: num((s.failed || 0) + (s.undelivered || 0)), badge: pct(r.failureRate), icon: AlertTriangle, tone: "text-red-600 dark:text-red-400" },
          { label: "Clicks", value: num(s.clicked), badge: pct(r.clickRate), icon: MousePointerClick, tone: "text-emerald-600 dark:text-emerald-400" },
          { label: "Replies", value: num(s.replied), badge: pct(r.replyRate), icon: MessageCircle, tone: "text-emerald-600 dark:text-emerald-400" },
          { label: "Opt-outs", value: num(s.opted_out), badge: pct(r.optOutRate), icon: ShieldAlert, tone: "text-amber-600 dark:text-amber-400" },
        ].map((item) => <Card key={item.label} className="rounded-xl"><CardContent className="space-y-2 p-4"><div className="flex items-center justify-between"><p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p><item.icon className={`h-4 w-4 ${item.tone}`} /></div><p className={`text-3xl font-semibold tabular-nums ${item.tone}`}>{item.value}</p>{item.badge ? <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs tabular-nums text-muted-foreground">{item.badge}</span> : null}</CardContent></Card>)}
      </div>

      <Card className="rounded-xl"><CardHeader><CardTitle>Funnel</CardTitle></CardHeader><CardContent className="space-y-3">{funnel.map((f: any, i: number) => { const step = i === 0 ? 100 : (f.value / Math.max(funnel[i - 1].value, 1)) * 100; return <div key={f.label} className="space-y-1.5"><div className="flex items-center justify-between text-sm"><span className="font-medium">{f.label}</span><span className="tabular-nums text-muted-foreground">{num(f.value)}{i === 0 ? "" : ` • ${pct(step)} from previous`}</span></div><div className="h-3 rounded-full bg-muted/70"><div className="h-3 rounded-full bg-gradient-to-r from-brand via-emerald-400 to-emerald-300 dark:from-brand dark:via-emerald-500 dark:to-emerald-400" style={{ width: `${(f.value / max) * 100}%` }} /></div></div> })}</CardContent></Card>

      <Card className="rounded-xl"><CardHeader><CardTitle>Cost</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm md:grid-cols-4"><div className="rounded-lg border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Total cost</p><p className="mt-1 text-xl font-semibold tabular-nums">{usd(s.total_cost_usd)}</p></div><div className="rounded-lg border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Cost per message</p><p className="mt-1 text-xl font-semibold tabular-nums">{usd(r.costPerMessage)}</p></div><div className="rounded-lg border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Total segments</p><p className="mt-1 text-xl font-semibold tabular-nums">{num(s.total_segments)}</p></div><div className="rounded-lg border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Avg segments</p><p className="mt-1 text-xl font-semibold tabular-nums">{Number(s.avg_segments || 0).toFixed(2)}</p></div><p className="md:col-span-4 text-xs text-muted-foreground">Billed by Telnyx on message finalization.</p></CardContent></Card>

      <Card className="rounded-xl"><CardHeader><CardTitle>Performance over time</CardTitle></CardHeader><CardContent>{timeline.length ? <ChartContainer config={{ delivered: { label: "Delivered", color: "hsl(var(--chart-2))" }, clicked: { label: "Clicked", color: "hsl(var(--chart-1))" }, replied: { label: "Replied", color: "hsl(var(--chart-4))" } }} className="h-[300px] w-full"><AreaChart data={timeline}><defs><linearGradient id="smsDelivered" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-delivered)" stopOpacity={0.32} /><stop offset="95%" stopColor="var(--color-delivered)" stopOpacity={0.03} /></linearGradient><linearGradient id="smsClicked" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-clicked)" stopOpacity={0.28} /><stop offset="95%" stopColor="var(--color-clicked)" stopOpacity={0.03} /></linearGradient><linearGradient id="smsReplied" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-replied)" stopOpacity={0.26} /><stop offset="95%" stopColor="var(--color-replied)" stopOpacity={0.03} /></linearGradient></defs><CartesianGrid vertical={false} /><XAxis dataKey="bucket" hide /><YAxis allowDecimals={false} /><ChartTooltip content={<ChartTooltipContent />} /><Legend /><Area type="monotone" dataKey="delivered" stroke="var(--color-delivered)" fill="url(#smsDelivered)" strokeWidth={2} /><Area type="monotone" dataKey="clicked" stroke="var(--color-clicked)" fill="url(#smsClicked)" strokeWidth={2} /><Area type="monotone" dataKey="replied" stroke="var(--color-replied)" fill="url(#smsReplied)" strokeWidth={2} /></AreaChart></ChartContainer> : <div className="flex h-[220px] flex-col items-center justify-center rounded-lg border border-dashed text-center"><TrendingUp className="mb-2 h-5 w-5 text-muted-foreground" /><p className="text-sm font-medium">No activity recorded yet</p><p className="text-xs text-muted-foreground">Timeline metrics will appear once delivery events are processed.</p></div>}</CardContent></Card>
    </TabsContent>
    <TabsContent value="links"><Card className="rounded-xl"><CardHeader><CardTitle>Top links</CardTitle></CardHeader><CardContent className="space-y-3">{topLinks.length ? topLinks.map((l: any, i: number) => <div key={l.url} className="rounded-lg border p-3"><div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2 min-w-0"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span><span className="truncate text-sm" title={l.url}>{l.url}</span></div><span className="text-sm tabular-nums text-muted-foreground">{num(l.totalClicks)} / {num(l.uniqueClickers)}</span></div><div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${((l.totalClicks || 0) / topClicks) * 100}%` }} /></div></div>) : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"><Link2 className="mx-auto mb-2 h-4 w-4" />No links clicked yet.</div>}</CardContent></Card></TabsContent>
    <TabsContent value="recipients"><Card><CardContent className="pt-6"><CampaignRecipientsTable channel="sms" recipients={analytics?.recipients || []} onRowClick={(r) => { setSelected(r); setSheetOpen(true) }} /></CardContent></Card></TabsContent>
    <SmsRecipientDrilldownSheet open={sheetOpen} onOpenChange={setSheetOpen} recipient={selected} />
  </Tabs>
}
