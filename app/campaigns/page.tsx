"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import MainLayout from "@/components/layout/main-layout"
import { CampaignService } from "@/services/campaign-service"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import ConfirmInputDialog from "@/components/ui/confirm-input-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import SmsCampaignModal from "@/components/campaigns/sms-campaign-modal"
import NewEmailCampaignModal from "@/components/campaigns/NewEmailCampaignModal"

export default function CampaignsPage() {
  const [channel, setChannel] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [smsOpen, setSmsOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const deleteCampaign = useMutation({
    mutationFn: (id: string) => CampaignService.deleteCampaign(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["campaigns"] })

      const previousQueries = queryClient.getQueriesData<{
        campaigns: any[]
        totalCount: number
      }>(["campaigns"])

      previousQueries.forEach(([queryKey, data]) => {
        if (!data) return

        const filteredCampaigns = data.campaigns.filter((c) => c.id !== id)
        queryClient.setQueryData(queryKey, {
          ...data,
          campaigns: filteredCampaigns,
          totalCount: Math.max(0, data.totalCount - 1),
        })
      })

      return { previousQueries }
    },
    onError: (_err, _id, context) => {
      context?.previousQueries.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data)
      })
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] })
    },
  })

  useEffect(() => {
    const type = searchParams.get("type")
    if (type === "sms") setSmsOpen(true)
    if (type === "email") setEmailOpen(true)
  }, [searchParams])

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", page, channel, status],
    queryFn: () =>
      CampaignService.listCampaigns(page, {
        ...(channel === "all" ? {} : { channel }),
        status,
      }),
  })

  const campaigns = data?.campaigns || []
  const total = data?.totalCount || 0
  const pageCount = Math.ceil(total / 20) || 1

  return (
    <MainLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>New Campaign</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSmsOpen(true)}>
                New SMS Campaign
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEmailOpen(true)}>
                New Email Campaign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-sm mb-1">Channel</label>
            <Select
              value={channel}
              onValueChange={(v) => {
                setPage(1)
                setChannel(v)
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm mb-1">Status</label>
            <Select
              value={status}
              onValueChange={(v) => {
                setPage(1)
                setStatus(v)
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Subject/Message</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Results</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8}>Loading...</TableCell>
                </TableRow>
              )}
              {!isLoading && campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>No campaigns found.</TableCell>
                </TableRow>
              )}
              {campaigns.map((c: any) => (
                <>
                  <TableRow key={c.id}>
                    <TableCell className="capitalize">{c.channel}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>
                      {c.channel === "email" ? c.subject : c.message?.slice(0, 40)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-sm text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-sm text-muted-foreground">
                      {c.scheduled_at
                        ? new Date(c.scheduled_at).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell>{c.campaign_recipients?.length || 0}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-xs space-y-0.5">
                          <div>
                            <span className="text-green-700">{c.sentCount}</span>{" "}/
                            <span className="text-red-700">{c.errorCount}</span>
                          </div>
                          <div>
                            <span className="text-green-700">Open {c.openedCount}</span>{" "}/
                            <span className="text-yellow-700">Bounce {c.bouncedCount}</span>{" "}/
                            <span className="text-muted-foreground">Unsub {c.unsubCount}</span>
                          </div>
                        </div>
                        <Progress
                          value={
                            c.campaign_recipients.length
                              ? (c.sentCount / c.campaign_recipients.length) * 100
                              : 0
                          }
                          className="h-2"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen(open === c.id ? null : c.id)}
                      >
                        {open === c.id ? "Hide" : "View"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteId(c.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                  {open === c.id && (
                    <TableRow key={`${c.id}-recipients`}>
                      <TableCell colSpan={8} className="p-0">
                        <div className="p-2 bg-muted rounded-b-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Buyer</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Sent</TableHead>
                                <TableHead>Opened</TableHead>
                                <TableHead>Bounced</TableHead>
                                <TableHead>Unsub</TableHead>
                                <TableHead>Error</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {c.campaign_recipients.map((r: any) => (
                                <TableRow key={r.id}>
                                  <TableCell className="font-mono text-xs">
                                    {r.buyers?.full_name ||
                                      `${r.buyers?.fname || ""} ${r.buyers?.lname || ""}`.trim() ||
                                      r.buyer_id}
                                  </TableCell>
                                  <TableCell>{r.status || "pending"}</TableCell>
                                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                                    {r.sent_at
                                      ? new Date(r.sent_at).toLocaleString()
                                      : "-"}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap font-mono text-xs">
                                    {r.opened_at ? new Date(r.opened_at).toLocaleString() : "-"}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap font-mono text-xs">
                                    {r.bounced_at ? new Date(r.bounced_at).toLocaleString() : "-"}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap font-mono text-xs">
                                    {r.unsubscribed_at ? new Date(r.unsubscribed_at).toLocaleString() : "-"}
                                  </TableCell>
                                  <TableCell className="text-xs text-red-700">
                                    {r.error || "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
        {pageCount > 1 && (
          <Pagination className="mt-2">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setPage(Math.max(1, page - 1))
                  }}
                  className={page === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {Array.from({ length: pageCount }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    href="#"
                    isActive={page === i + 1}
                    onClick={(e) => {
                      e.preventDefault()
                      setPage(i + 1)
                    }}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setPage(Math.min(pageCount, page + 1))
                  }}
                  className={page === pageCount ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
      <SmsCampaignModal
        open={smsOpen}
        onOpenChange={(o) => {
          setSmsOpen(o)
          if (!o) router.replace("/campaigns")
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["campaigns"] })
        }}
      />
      <NewEmailCampaignModal
        open={emailOpen}
        onOpenChange={(o) => {
          setEmailOpen(o)
          if (!o) router.replace("/campaigns")
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["campaigns"] })
        }}
      />
      <ConfirmInputDialog
        open={!!deleteId}
        onOpenChange={(o) => setDeleteId(o ? deleteId : null)}
        title="Delete Campaign"
        confirmationText="Delete this Campaign"
        actionText="Delete"
        onConfirm={async () => {
          if (deleteId) {
            await deleteCampaign.mutateAsync(deleteId)
            setDeleteId(null)
          }
        }}
      />
    </MainLayout>
  )
}
