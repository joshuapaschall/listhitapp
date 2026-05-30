"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Mail, MessageSquare, RefreshCw } from "lucide-react"
import CampaignStatusBadge from "@/components/campaigns/campaign-status-badge"
import ResumeCampaignButton from "@/components/campaigns/resume-campaign-button"
import EmailCampaignReport from "@/components/campaigns/EmailCampaignReport"
import SmsCampaignReport from "@/components/campaigns/SmsCampaignReport"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { supabaseBrowser } from "@/lib/supabase-browser"

type Campaign = { id: string; name: string; channel: "email" | "sms"; status: any; scheduled_at?: string | null; created_at?: string | null }

export default function CampaignReport({ campaign }: { campaign: Campaign }) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ["campaign-analytics", campaign.id],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaign.id}/analytics`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load analytics")
      return res.json()
    },
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const supabase = supabaseBrowser()
    const channel = supabase.channel(`campaign-report-${campaign.id}`).on("postgres_changes", { event: "*", schema: "public", table: "campaign_recipients", filter: `campaign_id=eq.${campaign.id}` }, () => qc.invalidateQueries({ queryKey: ["campaign-analytics", campaign.id] })).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [campaign.id, qc])

  return <div className="space-y-6 p-6">
    <div className="sticky top-0 z-20 rounded-xl border bg-background/90 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Button asChild variant="ghost" size="icon"><Link href="/campaigns"><ArrowLeft className="h-4 w-4" /></Link></Button><div><h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1><div className="text-sm text-muted-foreground">Sent date: {campaign.scheduled_at || campaign.created_at || "-"}</div></div><CampaignStatusBadge status={campaign.status} />{campaign.status === "paused_by_safety" ? <ResumeCampaignButton campaignId={campaign.id} /> : null}<Badge variant="secondary" className="gap-2">{campaign.channel === "sms" ? <MessageSquare className="h-3 w-3" /> : <Mail className="h-3 w-3" />}{campaign.channel.toUpperCase()}</Badge></div>
      <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button>
      </div>
    </div>
    {query.isLoading ? <div className="space-y-3"><Skeleton className="h-40 w-full" /><Skeleton className="h-80 w-full" /></div> : null}
    {query.isError ? <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">Unable to load analytics. <Button variant="link" onClick={() => query.refetch()} className="px-1">Retry</Button></div> : null}
    {!query.isLoading && !query.isError && (campaign.channel === "sms" ? <SmsCampaignReport campaign={campaign} analytics={query.data} /> : <EmailCampaignReport campaign={campaign} analytics={query.data} />)}
  </div>
}
