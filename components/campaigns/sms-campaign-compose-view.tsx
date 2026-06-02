"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Circle, TestTube2 } from "lucide-react"
import { toast } from "sonner"
import CampaignStatusBadge from "@/components/campaigns/campaign-status-badge"
import AudienceFilterSummaryCard from "@/components/campaigns/audience-filter-summary-card"
import RecipientsPreviewSheet from "@/components/campaigns/recipients-preview-sheet"
import GroupTreeSelector from "@/components/buyers/group-tree-selector"
import SmsComposerPanel from "@/components/campaigns/sms-composer-panel"
import SmsFromCard from "@/components/campaigns/sms-from-card"
import SmsMediaCard from "@/components/campaigns/sms-media-card"
import SmsSendTimeCard from "@/components/campaigns/sms-send-time-card"
import CampaignPropertySelector from "@/components/campaigns/campaign-property-selector"
import { readAudienceSnapshot, clearAudienceSnapshot, type CampaignAudienceSnapshot } from "@/lib/campaign-audience"
import { calculateSmsSegments } from "@/lib/sms-utils"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { BuyerService } from "@/services/buyer-service"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Can } from "@/components/auth/Can"



function CardRow({ id, title, summary, valid, ctaText, expandedCard, setExpandedCard, children }: {
  id: string
  title: string
  summary: string
  valid: boolean
  ctaText: string
  expandedCard: string | null
  setExpandedCard: (v: any) => void
  children: React.ReactNode
}) {
  return <Card className="overflow-hidden"><button onClick={() => setExpandedCard(expandedCard === id ? null : id)} className="w-full flex items-center justify-between p-5 hover:bg-muted/40 text-left"><div className="flex items-center gap-3">{valid ? <CheckCircle2 className="h-5 w-5 text-brand" /> : <Circle className="h-5 w-5 text-muted-foreground" />}<div><p className="font-medium text-base">{title}</p><p className="text-sm text-muted-foreground">{summary}</p></div></div><span className="text-sm text-brand font-medium">{expandedCard === id ? "Cancel" : valid ? "Edit" : ctaText}</span></button>{expandedCard === id && <div className="border-t p-5 bg-muted/20">{children}</div>}</Card>
}

function parseMediaUrls(value: unknown): string[] {
  if (!value || typeof value !== "string") return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return typeof value === "string" ? [value] : []
  }
}

export default function SmsCampaignComposeView({ initialCampaign }: { initialCampaign: any }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [campaign, setCampaign] = useState<any>(initialCampaign)
  const [expandedCard, setExpandedCard] = useState<"to"|"from"|"content"|"media"|"sendTime"|"property"|null>(null)
  const [autosaveState, setAutosaveState] = useState<"idle"|"saving"|"saved"|"failed">("idle")
  const [hasEdited, setHasEdited] = useState(false)
  const [hasPrefillSnapshot, setHasPrefillSnapshot] = useState<CampaignAudienceSnapshot | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [testPhone, setTestPhone] = useState("")
  const [sendingTest, setSendingTest] = useState(false)
  const [resolvedGroupBuyerIds, setResolvedGroupBuyerIds] = useState<string[]>([])
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const parsedTestPhone = useMemo(() => {
    if (!testPhone.trim()) return null
    return formatPhoneE164(testPhone)
  }, [testPhone])
  const isTestPhoneInvalid = testPhone.trim().length > 0 && !parsedTestPhone
  const campaignGroupIdsKey = useMemo(() => JSON.stringify(campaign.group_ids || []), [campaign.group_ids])

  useEffect(() => {
    const groupIds = JSON.parse(campaignGroupIdsKey) as string[]
    if (!groupIds.length) {
      setResolvedGroupBuyerIds([])
      return
    }
    let alive = true
    BuyerService.getBuyerIdsForGroups(groupIds)
      .then((ids) => { if (alive) setResolvedGroupBuyerIds(ids) })
      .catch(() => { if (alive) setResolvedGroupBuyerIds([]) })
    return () => { alive = false }
  }, [campaignGroupIdsKey])

  const allRecipientIds = useMemo(() => {
    const direct = campaign.buyer_ids || []
    return Array.from(new Set([...direct, ...resolvedGroupBuyerIds]))
  }, [campaign.buyer_ids, resolvedGroupBuyerIds])

  useEffect(() => setTestPhone(localStorage.getItem("listhit:smsTestNumber") ?? ""), [])
  const mediaUrls = parseMediaUrls(campaign.media_url)
  const segmentInfo = calculateSmsSegments(campaign.message ?? "")
  const recipientCount = hasPrefillSnapshot?.recipientCount ?? allRecipientIds.length
  const toValid = recipientCount > 0 || !!hasPrefillSnapshot
  const fromValid = true
  const contentValid = (!!campaign.message?.trim() || mediaUrls.length > 0) && segmentInfo.segments <= 10
  const sendTimeValid = !campaign.scheduled_at || new Date(campaign.scheduled_at).getTime() > Date.now()
  const canSend = toValid && fromValid && contentValid && sendTimeValid

  useEffect(() => {
    if (searchParams.get("prefill") !== "sms") return
    const snapshot = readAudienceSnapshot()
    if (snapshot?.channel === "sms") {
      setCampaign((prev: any) => ({ ...prev, buyer_ids: snapshot.buyerIds }))
      setHasPrefillSnapshot(snapshot)
      setHasEdited(true)
      clearAudienceSnapshot()
    }
  }, [searchParams])

  useEffect(() => {
    if (!hasEdited) return
    const timeout = setTimeout(async () => {
      setAutosaveState("saving")
      const save = async () => fetch(`/api/campaigns/${campaign.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campaign) })
      let res = await save()
      if (!res.ok) { await new Promise((r) => setTimeout(r, 1500)); res = await save() }
      if (res.status === 403) { router.push(`/campaigns/${campaign.id}`); return }
      setAutosaveState(res.ok ? "saved" : "failed")
    }, 1500)
    return () => clearTimeout(timeout)
  }, [campaign, hasEdited, router])

  const update = (patch: any) => { setCampaign((p: any) => ({ ...p, ...patch })); setHasEdited(true) }
  const sendNow = async () => {
    // Confirm the user still has a browser session before calling the
    // permission-gated send-now route.
    const supabase = supabaseBrowser()
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) {
      toast.error("Not logged in — please refresh and sign in again.")
      return
    }

    await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campaign),
    })
    const res = await fetch("/api/campaigns/send-now", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ campaignId: campaign.id }),
    })
    if (res.ok) {
      toast.success("Campaign sending…")
      router.push(`/campaigns/${campaign.id}`)
    } else {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error || "Send failed")
    }
  }

  const sendTest = async () => {
    setSendingTest(true)
    const res = await fetch("/api/campaigns/test-send-sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: campaign.id, testPhone }) })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      localStorage.setItem("listhit:smsTestNumber", testPhone)
      toast.success(`Test sent to ${data.formattedTo}${data.fromNumber ? ` from ${data.fromNumber}` : ""}`)
      if (data.dryRun) toast.info("Dry-run: no real SMS sent")
    } else {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error || "Test send failed")
    }
    setSendingTest(false)
  }



  return <div className="min-h-screen bg-background">
    <div className="sticky top-0 bg-background/80 backdrop-blur z-10 border-b border-border py-4 px-6"><div className="max-w-4xl mx-auto flex items-center justify-between"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => router.push("/campaigns")}><ArrowLeft className="h-4 w-4" /></Button><Input className="w-auto min-w-[200px] max-w-[400px]" value={campaign.name || "Untitled campaign"} onChange={(e) => update({ name: e.target.value })} /><CampaignStatusBadge status={campaign.status} />{hasEdited && <span className="text-xs text-muted-foreground">{autosaveState === "saving" ? "Saving…" : autosaveState === "failed" ? "Save failed" : "Saved"}</span>}</div><div className="flex items-start gap-2"><div><Input className="h-9 w-[130px]" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+1 (770) 555-0123" />{isTestPhoneInvalid && <p className="mt-1 text-xs text-red-500">Enter a valid US phone number</p>}</div><Can permission="campaigns.send_sms"><Button variant="outline" size="sm" disabled={!testPhone.trim() || isTestPhoneInvalid || sendingTest || !campaign.message?.trim()} onClick={sendTest}><TestTube2 className="h-4 w-4" />Send test</Button></Can><Can permission="campaigns.send_sms"><Button variant="brand" disabled={!canSend || !!campaign.scheduled_at} onClick={() => setSendConfirmOpen(true)}>Send</Button></Can></div></div></div>
    <main className="max-w-4xl mx-auto px-6 py-8 space-y-3">
      <CardRow expandedCard={expandedCard} setExpandedCard={setExpandedCard} id="to" title="To" valid={toValid} ctaText="Add recipients" summary={toValid ? `${recipientCount} recipients` : "Who are you sending this to?"}>{hasPrefillSnapshot ? <AudienceFilterSummaryCard snapshot={hasPrefillSnapshot} onPreview={() => setPreviewOpen(true)} onAdjust={() => router.push("/buyers")} onClear={() => { setHasPrefillSnapshot(null); update({ buyer_ids: [] }) }} /> : <GroupTreeSelector value={campaign.group_ids || []} onChange={(ids) => update({ group_ids: ids })} />}</CardRow>
      <CardRow expandedCard={expandedCard} setExpandedCard={setExpandedCard} id="from" title="From" valid={fromValid} ctaText="View sender" summary="Per-recipient routing with fallback"><SmsFromCard buyerIds={allRecipientIds} /></CardRow>
      <CardRow expandedCard={expandedCard} setExpandedCard={setExpandedCard} id="content" title="Content" valid={contentValid} ctaText="Compose SMS" summary={campaign.message?.trim() ? `Message ready — ${segmentInfo.segments} segments` : "Write your message"}><SmsComposerPanel message={campaign.message || ""} onMessageChange={(value) => update({ message: value })} buyerIds={allRecipientIds} recipientCount={recipientCount} mediaUrls={mediaUrls} /></CardRow>
      <CardRow expandedCard={expandedCard} setExpandedCard={setExpandedCard} id="media" title="Media" valid={true} ctaText="Add media" summary={mediaUrls.length ? `${mediaUrls.length} attachment(s)` : "Optional MMS attachments"}><SmsMediaCard mediaUrls={mediaUrls} onChange={(urls) => update({ media_url: JSON.stringify(urls) })} subject={campaign.subject} onSubjectChange={(value) => update({ subject: value })} /></CardRow>
      <CardRow expandedCard={expandedCard} setExpandedCard={setExpandedCard} id="property" title="Property" valid={true} ctaText="Attribute property" summary={campaign.property_id ? "Campaign cost attributed to a property" : "Optional property attribution"}><CampaignPropertySelector value={campaign.property_id ?? null} onChange={(property_id) => update({ property_id })} /></CardRow>
      <CardRow expandedCard={expandedCard} setExpandedCard={setExpandedCard} id="sendTime" title="Send time" valid={sendTimeValid} ctaText="Set send time" summary={campaign.scheduled_at ? `Scheduled for ${new Date(campaign.scheduled_at).toLocaleString()}` : "Send immediately when you click Send"}><SmsSendTimeCard scheduledAt={campaign.scheduled_at} onScheduledAtChange={(value) => update({ scheduled_at: value })} weekdayOnly={campaign.weekday_only} onWeekdayOnlyChange={(value) => update({ weekday_only: value })} runFrom={campaign.run_from} onRunFromChange={(value) => update({ run_from: value })} runUntil={campaign.run_until} onRunUntilChange={(value) => update({ run_until: value })} /></CardRow>
    </main>
    <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send campaign?</AlertDialogTitle>
          <AlertDialogDescription>
            This will send {recipientCount} SMS {recipientCount === 1 ? "message" : "messages"} now. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Can permission="campaigns.send_sms"><AlertDialogAction className="bg-brand text-white hover:bg-brand/90" onClick={async (e) => { e.preventDefault(); setSendConfirmOpen(false); await sendNow() }}>Send now</AlertDialogAction></Can>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <RecipientsPreviewSheet open={previewOpen} onOpenChange={setPreviewOpen} buyerIds={hasPrefillSnapshot?.buyerIds || []} />
  </div>
}
