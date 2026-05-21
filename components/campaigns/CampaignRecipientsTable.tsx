"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Check, ChevronDown, ChevronUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"

export type RecipientRow = any

type StatusOption = {
  value: string
  label: string
  predicate: (recipient: RecipientRow) => boolean
}

const PAGE_SIZE = 50

function getStatusOptions(channel: "sms" | "email"): StatusOption[] {
  if (channel === "sms") {
    return [
      { value: "all", label: "All", predicate: () => true },
      { value: "sent", label: "Sent", predicate: (r) => !!r?.sent_at },
      { value: "delivered", label: "Delivered", predicate: (r) => !!r?.delivered_at || /delivered/.test((r?.status || "").toLowerCase()) },
      { value: "clicked", label: "Clicked", predicate: (r) => !!r?.clicked_at },
      { value: "replied", label: "Replied", predicate: (r) => !!r?.replied_at },
      { value: "failed", label: "Failed / Undelivered", predicate: (r) => (/(fail|undeliver|error)/.test((r?.status || "").toLowerCase()) || !!r?.error) && !r?.delivered_at },
      { value: "optedout", label: "Opted-out", predicate: (r) => !!r?.unsubscribed_at || /(opt|unsub)/.test((r?.status || "").toLowerCase()) },
    ]
  }

  return [
    { value: "all", label: "All", predicate: () => true },
    { value: "delivered", label: "Delivered", predicate: (r) => !!r?.delivered_at },
    { value: "opened", label: "Opened", predicate: (r) => !!r?.opened_at },
    { value: "clicked", label: "Clicked", predicate: (r) => !!r?.clicked_at },
    { value: "bounced", label: "Bounced", predicate: (r) => !!r?.bounced_at || /bounce/.test((r?.status || "").toLowerCase()) },
    { value: "complained", label: "Complained", predicate: (r) => !!r?.complained_at || /complaint/.test((r?.status || "").toLowerCase()) },
    { value: "unsubscribed", label: "Unsubscribed", predicate: (r) => !!r?.unsubscribed_at || /unsub/.test((r?.status || "").toLowerCase()) },
  ]
}

export function getRecipientIdentity(recipient: RecipientRow) {
  const buyer = recipient?.buyer || {}
  const name = buyer.full_name
    || [buyer.fname, buyer.lname].filter(Boolean).join(" ")
    || [buyer.first_name, buyer.last_name].filter(Boolean).join(" ")
    || recipient?.email
    || buyer.email
    || buyer.email_address
    || buyer.phone
    || buyer.phone_number
    || "Unknown recipient"
  const email = recipient?.email || buyer.email || buyer.email_address || ""
  const phone = buyer.phone || buyer.phone_number || ""
  const company = buyer.company || ""
  return { name, email, phone, company }
}

export function getStatusBadgeClass(status?: string | null) {
  const s = (status || "").toLowerCase()
  if (/(failed|undelivered|error|bounce|complaint)/.test(s)) return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
  if (/(replied|reply|delivered|sent)/.test(s)) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
  if (/(opened|open)/.test(s)) return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
  if (/(clicked|click)/.test(s)) return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
  if (/(unsubscribed|opted_out|optout)/.test(s)) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
  if (/(queued|pending|processing)/.test(s)) return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300"
  return "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300"
}

function hasFailureSignal(recipient: RecipientRow) {
  const s = (recipient?.status || "").toLowerCase()
  return Boolean(recipient?.error) || /(failed|undelivered|error|bounce|complaint)/.test(s)
}

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : "")
const formatCost = (n?: number | null) => (n == null ? "—" : Math.abs(n) < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`)

export default function CampaignRecipientsTable({ channel, recipients, onRowClick }: { channel: "sms" | "email"; recipients: any[]; onRowClick: (recipient: any) => void }) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "recipient", dir: "asc" })

  const statusOptions = useMemo(() => getStatusOptions(channel), [channel])
  const selectedStatusOption = useMemo(() => statusOptions.find((option) => option.value === statusFilter) || statusOptions[0], [statusFilter, statusOptions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (recipients || []).filter((r) => {
      const id = getRecipientIdentity(r)
      const hay = `${id.name} ${id.email} ${id.phone} ${id.company}`.toLowerCase()
      const matchesQ = !q || hay.includes(q)
      const matchesStatus = selectedStatusOption?.predicate(r) ?? true
      return matchesQ && matchesStatus
    })
  }, [query, recipients, selectedStatusOption])

  const statusCounts = useMemo(() => {
    return statusOptions.reduce<Record<string, number>>((acc, option) => {
      acc[option.value] = (recipients || []).filter((recipient) => option.predicate(recipient)).length
      return acc
    }, {})
  }, [recipients, statusOptions])

  const sorted = useMemo(() => {
    const rows = [...filtered]
    rows.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1
      if (sort.key === "recipient") return getRecipientIdentity(a).name.localeCompare(getRecipientIdentity(b).name) * dir
      if (sort.key === "status") return String(a?.status || "").localeCompare(String(b?.status || "")) * dir
      if (sort.key === "segments") return ((a?.actual_segments ?? -1) - (b?.actual_segments ?? -1)) * dir
      if (sort.key === "cost") return ((a?.actual_cost_usd ?? -1) - (b?.actual_cost_usd ?? -1)) * dir
      const aVal = a?.[sort.key]
      const bVal = b?.[sort.key]
      if (!aVal && !bVal) return 0
      if (!aVal) return 1
      if (!bVal) return -1
      return (new Date(aVal).getTime() - new Date(bVal).getTime()) * dir
    })
    return rows
  }, [filtered, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const sortHead = (label: string, key: string) => <button className="inline-flex items-center gap-1 font-medium" onClick={() => { setPage(1); setSort((prev) => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" })) }}>{label}{sort.key === key ? (sort.dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : null}</button>
  const eventCell = (value?: string | null) => value ? <span title={formatDate(value)} className="text-emerald-600 dark:text-emerald-400"><Check className="h-4 w-4" /></span> : <span className="text-muted-foreground">—</span>

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Input placeholder="Search recipient, email, phone, company" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} className="sm:max-w-md" />
      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
        <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label} ({statusCounts[option.value] || 0})</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <p className="text-sm text-muted-foreground">Showing {filtered.length} of {recipients?.length || 0} recipients</p>
    {recipients?.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No recipients yet.</div> : <div className="overflow-x-auto overflow-hidden rounded-lg border"><Table><TableHeader className="sticky top-0 z-10 bg-card"><TableRow><TableHead className="whitespace-nowrap">{sortHead("Recipient", "recipient")}</TableHead><TableHead className="whitespace-nowrap">{sortHead("Status", "status")}</TableHead><TableHead className="whitespace-nowrap">{sortHead("Delivered", "delivered_at")}</TableHead>{channel === "email" ? <TableHead className="whitespace-nowrap">{sortHead("Opened", "opened_at")}</TableHead> : null}<TableHead className="whitespace-nowrap">{sortHead("Clicked", "clicked_at")}</TableHead>{channel === "sms" ? <TableHead className="whitespace-nowrap">{sortHead("Replied", "replied_at")}</TableHead> : <TableHead className="whitespace-nowrap">{sortHead("Bounced", "bounced_at")}</TableHead>}{channel === "email" ? <TableHead className="whitespace-nowrap">{sortHead("Unsubscribed", "unsubscribed_at")}</TableHead> : <><TableHead className="whitespace-nowrap">{sortHead("Segments", "segments")}</TableHead><TableHead className="whitespace-nowrap">{sortHead("Cost", "cost")}</TableHead><TableHead className="whitespace-nowrap">Carrier</TableHead><TableHead className="whitespace-nowrap">Issue</TableHead></>}</TableRow></TableHeader><TableBody>{pageRows.length === 0 ? <TableRow><TableCell colSpan={channel === "sms" ? 9 : 7} className="text-center text-sm text-muted-foreground">No recipients match this filter.</TableCell></TableRow> : pageRows.map((r) => { const id = getRecipientIdentity(r); return <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(r)}><TableCell><div className="max-w-[200px] truncate font-medium" title={id.name}>{id.name}</div><div className="truncate text-xs text-muted-foreground" title={channel === "sms" ? (id.phone || "—") : (id.email || "—")}>{channel === "sms" ? (id.phone || "—") : (id.email || "—")}</div></TableCell><TableCell><Badge className={getStatusBadgeClass(r?.status)}>{r?.status || "unknown"}</Badge></TableCell><TableCell>{eventCell(r?.delivered_at)}</TableCell>{channel === "email" ? <TableCell>{eventCell(r?.opened_at)}</TableCell> : null}<TableCell>{eventCell(r?.clicked_at)}</TableCell>{channel === "sms" ? <TableCell>{eventCell(r?.replied_at)}</TableCell> : <TableCell>{eventCell(r?.bounced_at)}</TableCell>}{channel === "email" ? <TableCell>{eventCell(r?.unsubscribed_at)}</TableCell> : <><TableCell>{r?.actual_segments ?? "—"}</TableCell><TableCell>{formatCost(r?.actual_cost_usd)}</TableCell><TableCell className="max-w-[160px]"><span className="block truncate" title={r?.recipient_carrier || ""}>{r?.recipient_carrier || "—"}</span></TableCell><TableCell>{hasFailureSignal(r) ? <span title={r?.error || "Delivery issue"}><AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" /></span> : <span className="text-muted-foreground">—</span>}</TableCell></>}</TableRow> })}</TableBody></Table></div>}
    {filtered.length > PAGE_SIZE ? <div className="flex items-center justify-end gap-3"><Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>Prev</Button><span className="text-sm text-muted-foreground">Page {safePage} of {totalPages}</span><Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Next</Button></div> : null}
  </div>
}
