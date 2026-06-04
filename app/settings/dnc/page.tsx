"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Ban, Download, Mail, MessageSquare, MoreVertical, Phone, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDebounce } from "@/hooks/use-debounce"
import { formatPhoneDisplay } from "@/lib/dedup-utils"
import AddToDncModal from "@/components/dnc/add-to-dnc-modal"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Buyer } from "@/lib/supabase"

interface DncResponse {
  rows: Buyer[]
  total: number
  page: number
  pageSize: number
  stats: { total: number; smsOut: number; emailUnsub: number; blocked: number }
}

const buyerName = (b: Buyer) =>
  b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed buyer"

const smsOk = (b: Buyer) => b.can_receive_sms !== false && !b.sms_suppressed
const emailOk = (b: Buyer) => b.can_receive_email !== false && !b.email_suppressed && !b.is_unsubscribed
const callsOk = (b: Buyer) => b.can_receive_calls !== false

function deriveSource(b: Buyer): string {
  if (b.blocked_at) return "Blocked"
  const reason = (b.sms_suppressed_reason || b.email_suppressed_reason || "").toLowerCase()
  if (reason.startsWith("keyword:")) return "Keyword"
  if (reason.includes("stop")) return "STOP reply"
  if (b.is_unsubscribed) return "Unsubscribed"
  return "Manual"
}

const addedAt = (b: Buyer) =>
  b.unsubscribed_at || b.sms_suppressed_at || b.email_suppressed_at || b.blocked_at || null

function ChannelChip({ ok, label }: { ok: boolean; label: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        ok
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-brand/10 text-brand",
      )}
    >
      {label}
      {ok ? "OK" : "Off"}
    </span>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Ban; label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/50 p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-xs">{label}</p>
      </div>
      <p className="mt-1.5 text-[22px] font-medium text-foreground">{value}</p>
    </div>
  )
}

export default function DncPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 350)

  const { data, isLoading } = useQuery<DncResponse>({
    queryKey: ["dnc", debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams({ search: debouncedSearch, page: String(page), pageSize: "25" })
      const res = await fetch(`/api/dnc?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load DNC list")
      return res.json()
    },
  })

  const rows = useMemo(() => data?.rows || [], [data?.rows])
  const stats = data?.stats || { total: 0, smsOut: 0, emailUnsub: 0, blocked: 0 }
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  const handleRemove = async (buyerId: string) => {
    setRemoving(buyerId)
    try {
      const res = await fetch(`/api/dnc/${buyerId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      if (!res.ok) throw new Error("Failed to remove")
      queryClient.invalidateQueries({ queryKey: ["dnc"] })
      toast.success("Removed from Do Not Contact")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove")
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Do Not Contact</h1>
          <p className="text-sm text-muted-foreground">Everyone who opted out by text, email, keyword, or that you added by hand.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { window.location.href = "/api/dnc/export" }}>
            <Download className="mr-2 h-4 w-4" />Export
          </Button>
          <Button variant="brand" onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />Add to DNC
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Ban} label="Total DNC" value={stats.total} />
        <StatCard icon={MessageSquare} label="SMS opted out" value={stats.smsOut} />
        <StatCard icon={Mail} label="Email unsub'd" value={stats.emailUnsub} />
        <StatCard icon={Ban} label="Blocked" value={stats.blocked} />
      </div>

      <Input
        value={search}
        onChange={(e) => {
          setPage(1)
          setSearch(e.target.value)
        }}
        placeholder="Search name, phone, or email"
        className="max-w-sm"
      />

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead className="w-20">SMS</TableHead>
              <TableHead className="w-20">Email</TableHead>
              <TableHead className="w-20">Calls</TableHead>
              <TableHead className="w-28">Source</TableHead>
              <TableHead className="w-28">Added</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7}>Loading...</TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">No one on the Do Not Contact list yet.</TableCell>
              </TableRow>
            )}
            {rows.map((b) => {
              const added = addedAt(b)
              return (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{buyerName(b)}</div>
                    <div className="text-xs text-muted-foreground">
                      {[formatPhoneDisplay(b.phone || "") || b.phone, b.email].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </TableCell>
                  <TableCell><ChannelChip ok={smsOk(b)} label={<MessageSquare className="h-3 w-3" />} /></TableCell>
                  <TableCell><ChannelChip ok={emailOk(b)} label={<Mail className="h-3 w-3" />} /></TableCell>
                  <TableCell><ChannelChip ok={callsOk(b)} label={<Phone className="h-3 w-3" />} /></TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{deriveSource(b)}</span></TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {added ? new Date(added).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={removing === b.id}>
                          <span className="sr-only">Actions</span>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleRemove(b.id)}>
                          Remove from DNC
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next
          </Button>
        </div>
      )}

      <AddToDncModal
        open={showAdd}
        onOpenChange={setShowAdd}
        onAdded={() => queryClient.invalidateQueries({ queryKey: ["dnc"] })}
      />
    </div>
  )
}
