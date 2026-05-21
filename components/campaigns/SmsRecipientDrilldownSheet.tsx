"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toast } from "@/components/ui/use-toast"
import { getRecipientIdentity, getStatusBadgeClass } from "./CampaignRecipientsTable"

function formatDate(value?: string | null) {
  if (!value) return "Not yet"
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
  const stages = [
    { label: "Sent", value: recipient?.sent_at },
    { label: "Delivered", value: recipient?.delivered_at },
    { label: "Clicked", value: recipient?.clicked_at },
    { label: "Replied", value: recipient?.replied_at },
    { label: "Opted-out", value: recipient?.unsubscribed_at },
    { label: "Failed / Undelivered", value: isFailure(recipient) ? (recipient?.error || recipient?.status || "Marked as failed") : null },
  ]

  const copy = async (value?: string, label?: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast({ title: `${label} copied` })
    } catch (error) {
      toast({ variant: "destructive", title: "Copy failed", description: error instanceof Error ? error.message : "Unable to copy" })
    }
  }

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
            {stages.map((s, idx) => {
              const active = Boolean(s.value)
              return <div key={s.label} className="flex gap-3"><div className="flex flex-col items-center"><span className={`h-3 w-3 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`} />{idx < stages.length - 1 ? <span className="h-8 w-px bg-border" /> : null}</div><div><p className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p><p className="text-xs text-muted-foreground">{typeof s.value === "string" && s.label !== "Failed / Undelivered" ? formatDate(s.value) : (s.value || "Not yet")}</p></div></div>
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-3"><p className="text-xs uppercase text-muted-foreground">Segments</p><p className="text-xl font-semibold">{recipient?.actual_segments ?? "—"}</p></div>
            <div className="rounded-lg border bg-card p-3"><p className="text-xs uppercase text-muted-foreground">Cost</p><p className="text-xl font-semibold">{cost(recipient?.actual_cost_usd)}</p></div>
            <div className="rounded-lg border bg-card p-3"><p className="text-xs uppercase text-muted-foreground">Carrier</p><p className="text-xl font-semibold">{recipient?.recipient_carrier || "—"}</p></div>
          </div>
          {recipient?.error ? <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{recipient.error}</div> : null}
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => copy(identity.phone, "Phone")} disabled={!identity.phone}>Copy phone</Button>
            {identity.email ? <Button size="sm" variant="outline" onClick={() => copy(identity.email, "Email")}>Copy email</Button> : null}
            {recipient?.buyer?.id ? <Button size="sm" variant="secondary" asChild><Link href={`/?buyerId=${encodeURIComponent(recipient.buyer.id)}`}>Open buyer</Link></Button> : null}
          </div>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
}
