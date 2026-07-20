"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format, formatDistanceToNow } from "date-fns"
import { useRouter, useSearchParams } from "next/navigation"
import {
  BarChart3,
  Copy,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import MainLayout from "@/components/layout/main-layout"
import { CampaignService } from "@/services/campaign-service"
import { Button } from "@/components/ui/button"
import CampaignChannelPicker from "@/components/campaigns/campaign-channel-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import ConfirmInputDialog from "@/components/ui/confirm-input-dialog"
import CampaignStatusBadge from "@/components/campaigns/campaign-status-badge"
import { clearAudienceSnapshot, readAudienceSnapshot } from "@/lib/campaign-audience"
import { toast } from "sonner"
import { CanAny } from "@/components/auth/Can"
import { usePermissions } from "@/hooks/use-permissions"

type CampaignRow = any
type UiStatus = "draft" | "scheduled" | "sending" | "sent" | "error" | "completed_with_errors"

export default function CampaignsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [channelFilter, setChannelFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [sortBy, setSortBy] = useState("last_edited")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { can, isAdmin, loading: permissionsLoading } = usePermissions()
  const canViewCampaigns = isAdmin || can("campaigns.view")

  useEffect(() => {
    const type = searchParams.get("type")
    const prefill = searchParams.get("prefill")
    if (type === "sms" && !prefill) {
      router.replace("/campaigns/new?type=sms")
      return
    }
    if (prefill === "email" || prefill === "sms") {
      const snapshot = readAudienceSnapshot()
      if (snapshot && snapshot.channel === prefill) {
        router.replace(`/campaigns/new?prefill=${prefill}`)
      }
    }
  }, [searchParams, router])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["campaigns", "wave-a2"],
    queryFn: () => CampaignService.listCampaigns(1, {}, 100),
    enabled: !permissionsLoading && canViewCampaigns,
  })

  const campaigns = data?.campaigns || []
  const sentThisMonth = useMemo(() => {
    const now = new Date()
    return campaigns.filter((c: CampaignRow) => {
      if (c.status !== "sent" || !c.sent_at) return false
      const sentAt = new Date(c.sent_at)
      return sentAt.getMonth() === now.getMonth() && sentAt.getFullYear() === now.getFullYear()
    }).length
  }, [campaigns])

  const normalizedStatus = (status: string): UiStatus => {
    if (status === "processing") return "sending"
    if (status === "pending") return "draft"
    if (status === "draft" || status === "scheduled" || status === "sent" || status === "error" || status === "completed_with_errors") {
      return status
    }
    return "draft"
  }

  const isInDateRange = (value?: string | null) => {
    if (!value || dateFilter === "all") return true
    const now = new Date()
    const date = new Date(value)
    if (dateFilter === "last_7") return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    if (dateFilter === "last_30") return date >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    if (dateFilter === "last_90") return date >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    if (dateFilter === "this_year") return date.getFullYear() === now.getFullYear()
    return true
  }

  const filteredCampaigns = useMemo(() => {
    const list = campaigns
      .filter((c: CampaignRow) => c.name?.toLowerCase().includes(search.toLowerCase()))
      .filter((c: CampaignRow) => statusFilter === "all" || normalizedStatus(c.status) === statusFilter)
      .filter((c: CampaignRow) => channelFilter === "all" || c.channel === channelFilter)
      .filter((c: CampaignRow) => isInDateRange(c.sent_at || c.scheduled_at || c.created_at))

    return list.sort((a: CampaignRow, b: CampaignRow) => {
      if (sortBy === "last_edited") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === "sent_date") {
        return new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime()
      }
      if (sortBy === "recipients") {
        return (b.recipientCount || 0) - (a.recipientCount || 0)
      }
      return 0
    })
  }, [campaigns, search, statusFilter, channelFilter, dateFilter, sortBy])

  const hasAnyFilters = search || statusFilter !== "all" || channelFilter !== "all" || dateFilter !== "all"

  const formatSentScheduled = (campaign: CampaignRow) => {
    const uiStatus = normalizedStatus(campaign.status)
    if (uiStatus === "sent" && campaign.sent_at) {
      const sentDate = new Date(campaign.sent_at)
      const daysAgo = (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
      return daysAgo < 7 ? `${formatDistanceToNow(sentDate)} ago` : format(sentDate, "MMM d")
    }
    if (uiStatus === "scheduled" && campaign.scheduled_at) {
      return `Scheduled: ${format(new Date(campaign.scheduled_at), "MMM d, h:mm a")}`
    }
    if ((uiStatus === "error" || uiStatus === "completed_with_errors") && campaign.sent_at) {
      return `Failed ${format(new Date(campaign.sent_at), "MMM d")}`
    }
    return "—"
  }

  const handleDuplicate = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/duplicate`, { method: "POST" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to duplicate campaign")
      }
      toast.success("Duplicated to drafts")
      router.push(`/campaigns/${payload.id}/edit`)
    } catch (error: any) {
      toast.error(error.message || "Failed to duplicate campaign")
    }
  }

  if (permissionsLoading) {
    return (
      <MainLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading campaign permissions...</p>
        </div>
      </MainLayout>
    )
  }

  if (!canViewCampaigns) {
    return (
      <MainLayout>
        <div className="flex h-[60vh] items-center justify-center bg-background">
          <div className="max-w-md px-6 text-center">
            <Mail className="mx-auto mb-4 size-12 text-secondary" />
            <h2 className="mb-2 text-xl font-semibold">You don&apos;t have access to Campaigns</h2>
            <p className="text-sm text-muted-foreground">
              Ask an administrator to grant campaigns.view before you can view campaigns.
            </p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="px-6 py-8 max-w-[1400px] mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Campaigns</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {campaigns.length} campaigns • {sentThisMonth} sent this month
            </p>
          </div>
          <CanAny permissions={["campaigns.send_sms", "campaigns.send_email"]}>
            <Button variant="brand" onClick={() => !pickerOpen && setPickerOpen(true)}><Plus className="size-4" />New Campaign</Button>
          </CanAny>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input className="h-9 pl-9" placeholder="Search campaigns…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="sending">Sending</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="last_7">Last 7 days</SelectItem>
              <SelectItem value="last_30">Last 30 days</SelectItem>
              <SelectItem value="last_90">Last 90 days</SelectItem>
              <SelectItem value="this_year">This year</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="last_edited">Sort: Last edited</SelectItem>
                <SelectItem value="sent_date">Sent date</SelectItem>
                <SelectItem value="recipients">Recipients (high to low)</SelectItem>
                <SelectItem value="open_rate">Open rate</SelectItem>
                <SelectItem value="click_rate">Click rate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading || isFetching ? (
          <div className="space-y-2 rounded-lg border bg-card p-4">
            {Array.from({ length: 5 }).map((_, idx) => <div key={idx} className="h-16 animate-pulse rounded-md bg-muted" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-lg border bg-card py-24 text-center">
            <Mail className="mx-auto size-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold">No campaigns yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Send your first email or SMS campaign to start reaching your buyers.</p>
            <CanAny permissions={["campaigns.send_sms", "campaigns.send_email"]}>
              <Button variant="brand" className="mt-6" onClick={() => !pickerOpen && setPickerOpen(true)}>Create your first campaign</Button>
            </CanAny>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="rounded-lg border bg-card py-24 text-center">
            <Mail className="mx-auto size-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-semibold">No campaigns match your filters</h2>
            <Button variant="outline" className="mt-6" onClick={() => {
              setSearch("")
              setStatusFilter("all")
              setChannelFilter("all")
              setDateFilter("all")
            }}>Clear filters</Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/70 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground/90">Campaign</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground/90">Status</TableHead>
                  <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground/90">Recipients</TableHead>
                  <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground/90">Sent / Scheduled</TableHead>
                  <TableHead className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground/90">Engagement</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign: CampaignRow) => {
                  const uiStatus = normalizedStatus(campaign.status)
                  const recipientsCount = campaign.recipientCount || 0
                  const opens = recipientsCount ? Math.round(((campaign.openedCount || 0) / recipientsCount) * 100) : 0
                  const delivered = recipientsCount ? Math.round(((campaign.deliveredCount || 0) / recipientsCount) * 100) : 0
                  const clicks = recipientsCount ? Math.round(((campaign.clickedCount || 0) / recipientsCount) * 100) : 0
                  const subjectPreview = (campaign.subject || campaign.message || "").slice(0, 60)
                  const isSms = campaign.channel === "sms"
                  const isEmail = campaign.channel === "email"
                  return (
                    <TableRow key={campaign.id} className="border-b border-border/70 transition-colors duration-150 ease-linear hover:bg-muted/35">
                      <TableCell className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          {isEmail ? <Mail className="mt-0.5 size-4 text-muted-foreground" /> : <MessageSquare className="mt-0.5 size-4 text-muted-foreground" />}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium leading-5 text-foreground">{campaign.name}</span>
                              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{campaign.channel}</span>
                            </div>
                            <div className="max-w-[440px] truncate pt-0.5 text-xs leading-5 text-muted-foreground">{subjectPreview || "—"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 align-middle"><CampaignStatusBadge status={uiStatus} /></TableCell>
                      <TableCell className="px-4 py-4 text-right text-sm tabular-nums">{recipientsCount || "—"}</TableCell>
                      <TableCell className="px-4 py-4 text-right text-sm tabular-nums">
                        <span className={uiStatus === "error" || uiStatus === "completed_with_errors" ? "text-red-700" : "text-muted-foreground"}>
                          {formatSentScheduled(campaign)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right text-sm tabular-nums text-muted-foreground">
                        {uiStatus === "sent" || uiStatus === "completed_with_errors"
                          ? isSms
                            ? `${delivered}% delivered • ${clicks}% clicks`
                            : isEmail
                              ? `${opens}% opens • ${clicks}% clicks`
                              : "—"
                          : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(uiStatus === "sent" || uiStatus === "sending" || uiStatus === "completed_with_errors") && (
                            <Button variant="ghost" size="icon" onClick={() => router.push(`/campaigns/${campaign.id}`)}>
                              <BarChart3 className="size-4" />
                            </Button>
                          )}
                          {(uiStatus === "draft" || uiStatus === "scheduled") && (
                            <CanAny permissions={["campaigns.send_sms", "campaigns.send_email"]}>
                              <Button variant="ghost" size="icon" onClick={() => router.push(uiStatus === "draft" ? `/campaigns/${campaign.id}/edit` : `/campaigns/${campaign.id}`)}>
                                <Pencil className="size-4" />
                              </Button>
                            </CanAny>
                          )}
                          <CanAny permissions={["campaigns.send_sms", "campaigns.send_email"]}>
                            <Button variant="ghost" size="icon" onClick={() => handleDuplicate(campaign.id)}>
                              <Copy className="size-4" />
                            </Button>
                          </CanAny>
                          <CanAny permissions={["campaigns.send_sms", "campaigns.send_email"]}>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(campaign.id)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </CanAny>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {data?.campaigns?.length === 100 && !hasAnyFilters && (
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["campaigns"] })}>Load more</Button>
          </div>
        )}
      </div>

      <CampaignChannelPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(channel) => {
          router.push(`/campaigns/new?type=${channel}`)
          setPickerOpen(false)
        }}
      />

      <ConfirmInputDialog
        open={!!deleteId}
        onOpenChange={(o) => setDeleteId(o ? deleteId : null)}
        title="Delete Campaign"
        confirmationText="Delete this Campaign"
        actionText="Delete"
        onConfirm={async () => {
          if (!deleteId) return
          await CampaignService.deleteCampaign(deleteId)
          // Close the dialog FIRST. Awaiting invalidateQueries here would block
          // the close until the list refetches, which unmounts the trigger row
          // mid-close and can leave Radix's pointer-events:none stuck on <body>
          // (the delete-freeze). Clearing deleteId closes the dialog; the refetch
          // is fire-and-forget so it can't block the close.
          setDeleteId(null)
          toast.success("Campaign deleted")
          void queryClient.invalidateQueries({ queryKey: ["campaigns"] })
        }}
      />
    </MainLayout>
  )
}
