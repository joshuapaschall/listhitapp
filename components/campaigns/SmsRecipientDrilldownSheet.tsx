"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { getRecipientIdentity, getStatusBadgeClass } from "./CampaignRecipientsTable"

function formatDate(value?: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function isFailure(recipient: any) {
  const s = (recipient?.status || "").toLowerCase()
  return Boolean(recipient?.error) || /(failed|undelivered|error|bounce|complaint)/.test(s)
}

function cost(n?: number | null) {
  if (n == null) return "—"
  return Math.abs(n) < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`
}

export default function SmsRecipientDrilldownSheet({ open, onOpenChange, recipient }: { open: boolean; onOpenChange: (o: boolean) => void; recipient: any | null }) {
  const identity = getRecipientIdentity(recipient)
  const events: { label: string; timestamp: string | null }[] = [
    recipient?.sent_at ? { label: "Sent", timestamp: recipient.sent_at } : null,
    recipient?.delivered_at ? { label: "Delivered", timestamp: recipient.delivered_at } : null,
    recipient?.clicked_at ? { label: "Clicked", timestamp: recipient.clicked_at } : null,
    recipient?.replied_at ? { label: "Replied", timestamp: recipient.replied_at } : null,
    recipient?.unsubscribed_at ? { label: "Opted-out", timestamp: recipient.unsubscribed_at } : null,
    isFailure(recipient) && !recipient?.delivered_at
      ? {
        label: "Failed / Undelivered",
        timestamp: recipient?.sent_at || null,
      }
      : null,
  ]
    .filter((event): event is { label: string; timestamp: string | null } => Boolean(event))
    .sort((a: any, b: any) => {
      const aTime = a?.timestamp ? new Date(a.timestamp).getTime() : Number.POSITIVE_INFINITY
      const bTime = b?.timestamp ? new Date(b.timestamp).getTime() : Number.POSITIVE_INFINITY
      return aTime - bTime
    })

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-[360px] p-0 sm:w-[560px]">
      <SheetHeader className="border-b px-6 py-4">
        <SheetTitle>{identity.name}</SheetTitle>
        <SheetDescription>{identity.phone || "No phone available"}</SheetDescription>
      </SheetHeader>
      <ScrollArea className="h-full">
        <div className="space-y-6 px-6 py-5">
          <Badge className={getStatusBadgeClass(recipient?.status)}>{recipient?.status || "unknown"}</Badge>
          <div className="space-y-3">
            {events.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : events.map((event, idx) => {
              return <div key={`${event.label}-${event.timestamp || idx}`} className="flex gap-3"><div className="flex flex-col items-center"><span className="h-3 w-3 rounded-full bg-emerald-500" />{idx < events.length - 1 ? <span className="h-8 w-px bg-border" /> : null}</div><div><p className="text-sm font-medium text-foreground">{event.label}</p><p className="text-xs text-muted-foreground">{formatDate(event.timestamp)}</p></div></div>
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-3"><p className="text-xs uppercase text-muted-foreground">Segments</p><p className="text-xl font-semibold">{recipient?.actual_segments ?? "—"}</p></div>
            <div className="rounded-lg border bg-card p-3"><p className="text-xs uppercase text-muted-foreground">Cost</p><p className="text-xl font-semibold">{cost(recipient?.actual_cost_usd)}</p></div>
            <div className="rounded-lg border bg-card p-3 sm:col-span-2"><p className="text-xs uppercase text-muted-foreground">Carrier</p><p className="text-xl font-semibold break-words">{recipient?.recipient_carrier || "—"}</p></div>
          </div>
          {recipient?.error ? <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{recipient.error}</div> : null}
          <Separator />
          <div className="flex flex-wrap gap-2">
            {recipient?.buyer?.id ? <Button size="sm" asChild><Link href={`/inbox?buyerId=${encodeURIComponent(recipient.buyer.id)}`}>Open conversation</Link></Button> : null}
            {recipient?.buyer?.id ? <Button size="sm" variant="secondary" asChild><Link href={`/?buyerId=${encodeURIComponent(recipient.buyer.id)}`}>Open buyer</Link></Button> : null}
          </div>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
}
