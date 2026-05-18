"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react"
import { toast } from "sonner"
import CampaignStatusBadge from "@/components/campaigns/campaign-status-badge"
import AudienceFilterSummaryCard from "@/components/campaigns/audience-filter-summary-card"
import RecipientsPreviewSheet from "@/components/campaigns/recipients-preview-sheet"
import EmailBuilder, { type EmailBuilderValue } from "@/components/email-builder/email-builder"
import GroupTreeSelector from "@/components/buyers/group-tree-selector"
import { readAudienceSnapshot, clearAudienceSnapshot, type CampaignAudienceSnapshot } from "@/lib/campaign-audience"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { BuyerService } from "@/services/buyer-service"

export default function CampaignComposeView({ initialCampaign }: { initialCampaign: any }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [campaign, setCampaign] = useState<any>(initialCampaign)
  const [expandedCard, setExpandedCard] = useState<"to"|"from"|"subject"|"sendTime"|"content"|null>(null)
  const [autosaveState, setAutosaveState] = useState<"idle"|"saving"|"saved"|"failed">("idle")
  const [hasEdited, setHasEdited] = useState(false)
  const [hasPrefillSnapshot, setHasPrefillSnapshot] = useState<CampaignAudienceSnapshot | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [contentSheetOpen, setContentSheetOpen] = useState(false)
  const [builderValue, setBuilderValue] = useState<EmailBuilderValue>({ subject: campaign.subject || "", html: campaign.message || "", blocks: [], markdown: "", previewText: campaign.preview_text || "", format: "blocks" })
  const [resolvedGroupBuyerIds, setResolvedGroupBuyerIds] = useState<string[]>([])

  useEffect(() => {
    const groupIds = campaign.group_ids || []
    if (!groupIds.length) {
      setResolvedGroupBuyerIds([])
      return
    }
    let alive = true
    BuyerService.getBuyerIdsForGroups(groupIds)
      .then((ids) => { if (alive) setResolvedGroupBuyerIds(ids) })
      .catch(() => { if (alive) setResolvedGroupBuyerIds([]) })
    return () => { alive = false }
  }, [JSON.stringify(campaign.group_ids || [])])

  const allRecipientIds = useMemo(() => {
    const direct = campaign.buyer_ids || []
    return Array.from(new Set([...direct, ...resolvedGroupBuyerIds]))
  }, [campaign.buyer_ids, resolvedGroupBuyerIds])

  const isValidEmail = (v?: string) => !!v && /.+@.+\..+/.test(v)
  const toValid = ((campaign.group_ids?.length || 0) + (campaign.buyer_ids?.length || 0)) > 0 || !!hasPrefillSnapshot
  const fromValid = !!campaign.from_name && isValidEmail(campaign.from_email)
  const subjectValid = !!campaign.subject?.trim()
  const sendTimeValid = !campaign.scheduled_at || new Date(campaign.scheduled_at).getTime() > Date.now()
  const contentValid = !!campaign.message?.trim() && campaign.message.trim().length > 50
  const canSend = toValid && fromValid && subjectValid && sendTimeValid && contentValid

  useEffect(() => {
    if (searchParams.get("prefill") !== "email") return
    const snapshot = readAudienceSnapshot()
    if (snapshot?.channel === "email") {
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
      if (!res.ok) {
        toast.error("Failed to save changes — retrying…")
        await new Promise((r) => setTimeout(r, 5000))
        res = await save()
      }
      if (res.status === 403) {
        toast.error("This campaign has already been sent and can't be edited.")
        router.push(`/campaigns/${campaign.id}`)
        return
      }
      setAutosaveState(res.ok ? "saved" : "failed")
    }, 1500)
    return () => clearTimeout(timeout)
  }, [campaign, hasEdited, router])

  const update = (patch: any) => { setCampaign((p: any) => ({ ...p, ...patch })); setHasEdited(true) }

  const itemsMissing = [!toValid && "Recipients", !subjectValid && "Subject", !contentValid && "Content"].filter(Boolean).join(", ")

  const sendNow = async () => {
    if (!confirm(`Send ${hasPrefillSnapshot?.recipientCount ?? allRecipientIds.length} emails now?`)) return
    await fetch(`/api/campaigns/${campaign.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campaign) })
    const response = await fetch("/api/campaigns/send", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}` }, body: JSON.stringify({ campaignId: campaign.id }) })
    if (response.ok) { toast.success("Campaign sending — you'll see results shortly."); router.push(`/campaigns/${campaign.id}`) } else { toast.error("Send failed — please try again.") }
  }

  const CardRow = ({ title, summary, valid, id, ctaText, children }: any) => (
    <Card className="overflow-hidden">
      <button onClick={() => setExpandedCard(expandedCard === id ? null : id)} className="w-full flex items-center justify-between p-5 hover:bg-muted/40 transition-colors text-left">
        <div className="flex items-center gap-3">{valid ? <CheckCircle2 className="h-5 w-5 text-brand"/> : <Circle className="h-5 w-5 text-muted-foreground"/>}<div><p className="font-medium text-base">{title}</p><p className="text-sm text-muted-foreground">{summary}</p></div></div>
        <span className="text-sm text-brand font-medium">{expandedCard === id ? "Cancel" : valid ? "Edit" : ctaText}</span>
      </button>
      {expandedCard === id && <div className="border-t border-border p-5 bg-muted/20">{children}</div>}
    </Card>
  )

  return <div className="min-h-screen bg-background">
    <div className="sticky top-0 bg-background/80 backdrop-blur z-10 border-b border-border py-4 px-6">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => router.push("/campaigns")}><ArrowLeft className="h-4 w-4" /></Button><Input className="w-auto min-w-[200px] max-w-[400px]" value={campaign.name || "Untitled campaign"} onChange={(e) => update({ name: e.target.value })} /><CampaignStatusBadge status={campaign.status} />{hasEdited && <span className="text-xs text-muted-foreground ml-2">{autosaveState === "saving" ? "Saving…" : autosaveState === "failed" ? "Save failed" : "Saved"}</span>}</div>
        <div className="flex gap-2"><Button variant="ghost" onClick={() => router.push("/campaigns")}>Finish later</Button><Button variant="outline" disabled={!canSend || !campaign.scheduled_at} title={!canSend ? `Add: ${itemsMissing}` : ""}>Schedule</Button><Button variant="brand" disabled={!canSend || !!campaign.scheduled_at} title={!canSend ? `Add: ${itemsMissing}` : ""} onClick={sendNow}>Send</Button></div>
      </div>
    </div>
    <main className="max-w-4xl mx-auto px-6 py-8 space-y-3">
      <CardRow id="to" title="To" valid={toValid} ctaText="Add recipients" summary={toValid ? `${hasPrefillSnapshot?.recipientCount ?? allRecipientIds.length} recipients` : "Who are you sending this to?"}>{hasPrefillSnapshot ? <AudienceFilterSummaryCard snapshot={hasPrefillSnapshot} onPreview={() => setPreviewOpen(true)} onAdjust={() => router.push("/buyers")} onClear={() => { setHasPrefillSnapshot(null); update({ buyer_ids: [] }) }} /> : <GroupTreeSelector value={campaign.group_ids || []} onChange={(ids) => update({ group_ids: ids })} />}</CardRow>
      <CardRow id="from" title="From" valid={fromValid} ctaText="Add sender" summary={fromValid ? `${campaign.from_name} <${campaign.from_email}>` : "Who is sending this campaign?"}><div className="space-y-3"><Input placeholder="GA Wholesale Homes" value={campaign.from_name || ""} onChange={(e) => update({ from_name: e.target.value })} /><Input placeholder="homes@example.com" value={campaign.from_email || ""} onChange={(e) => update({ from_email: e.target.value })} /></div></CardRow>
      <CardRow id="subject" title="Subject" valid={subjectValid} ctaText="Add subject" summary={subjectValid ? campaign.subject : "What's the subject line?"}><Input maxLength={150} value={campaign.subject || ""} onChange={(e) => update({ subject: e.target.value })} /></CardRow>
      <CardRow id="sendTime" title="Send time" valid={sendTimeValid} ctaText="Set send time" summary={campaign.scheduled_at ? `Scheduled for ${new Date(campaign.scheduled_at).toLocaleString()}` : "Send immediately when you click Send"}><Input type="datetime-local" onChange={(e) => update({ scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></CardRow>
      <CardRow id="content" title="Content" valid={contentValid} ctaText="Design email" summary={contentValid ? `Email designed — ${(campaign.message || "").split(/\s+/).filter(Boolean).length} words` : "Design the email body"}><Button onClick={() => setContentSheetOpen(true)}>Open builder</Button></CardRow>
    </main>
    <Sheet open={contentSheetOpen} onOpenChange={setContentSheetOpen}><SheetContent className="w-full sm:max-w-full"><div className="flex justify-between mb-4"><Button variant="ghost" onClick={() => setContentSheetOpen(false)}>Cancel</Button><Button onClick={() => { update({ message: builderValue.html, subject: builderValue.subject, preview_text: builderValue.previewText }); setContentSheetOpen(false) }}>Save & Close</Button></div><EmailBuilder value={builderValue} onChange={setBuilderValue} /></SheetContent></Sheet>
    <RecipientsPreviewSheet open={previewOpen} onOpenChange={setPreviewOpen} buyerIds={hasPrefillSnapshot?.buyerIds || []} />
  </div>
}
