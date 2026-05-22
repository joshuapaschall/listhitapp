"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react"
import { toast } from "sonner"
import CampaignStatusBadge from "@/components/campaigns/campaign-status-badge"
import AudienceFilterSummaryCard from "@/components/campaigns/audience-filter-summary-card"
import RecipientsPreviewSheet from "@/components/campaigns/recipients-preview-sheet"
import dynamic from "next/dynamic"
import type { TemplaticalEmailEditorHandle } from "@/components/campaigns/email/templatical-email-editor"
import GroupTreeSelector from "@/components/buyers/group-tree-selector"
import { readAudienceSnapshot, clearAudienceSnapshot, type CampaignAudienceSnapshot } from "@/lib/campaign-audience"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { BuyerService } from "@/services/buyer-service"
import { TemplateService } from "@/services/template-service"
import SmsSendTimeCard from "@/components/campaigns/sms-send-time-card"


const TemplaticalEmailEditor = dynamic(() => import("@/components/campaigns/email/templatical-email-editor"), {
  ssr: false,
})

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
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setExpandedCard(expandedCard === id ? null : id)} className="w-full flex items-center justify-between p-5 hover:bg-muted/40 transition-colors text-left">
        <div className="flex items-center gap-3">{valid ? <CheckCircle2 className="h-5 w-5 text-brand"/> : <Circle className="h-5 w-5 text-muted-foreground"/>}<div><p className="font-medium text-base">{title}</p><p className="text-sm text-muted-foreground">{summary}</p></div></div>
        <span className="text-sm text-brand font-medium">{expandedCard === id ? "Cancel" : valid ? "Edit" : ctaText}</span>
      </button>
      {expandedCard === id && <div className="border-t border-border p-5 bg-muted/20">{children}</div>}
    </Card>
  )
}

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
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)
  const editorRef = useRef<TemplaticalEmailEditorHandle>(null)
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
    // Get the logged-in user's access token. This JWT carries the `sub` claim
    // that the send route requires; the anon key does not.
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
    const response = await fetch("/api/campaigns/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ campaignId: campaign.id }),
    })
    if (response.ok) {
      toast.success("Campaign sending…")
      setSendConfirmOpen(false)
      router.push(`/campaigns/${campaign.id}`)
    } else {
      const body = await response.json().catch(() => ({}))
      toast.error(body?.error || "Send failed")
    }
  }

  const onSaveContent = async () => {
    const editor = editorRef.current
    if (!editor?.isReady()) {
      toast.error("Editor not ready — try again in a moment")
      return
    }

    try {
      const design = editor.getContent()
      const mjml = await editor.toMjml()

      if (!design || !mjml.trim()) {
        toast.error("Nothing to save yet — add content first")
        return
      }

      const res = await fetch("/api/campaigns/email/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mjml }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Failed to render email")
      }

      const { html } = await res.json()
      update({ message: html, design_json: design, mjml })
      setContentSheetOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save content"
      toast.error(message)
    }
  }

  const saveAsTemplate = async () => {
    const editor = editorRef.current
    if (!editor?.isReady()) {
      toast.error("Editor not ready — try again")
      return
    }
    setSavingTemplate(true)
    try {
      const design = editor.getContent()
      const mjml = await editor.toMjml()
      if (!design || !mjml.trim()) {
        toast.error("Nothing to save yet — add content first")
        return
      }
      const res = await fetch("/api/campaigns/email/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mjml }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Failed to render email")
      }
      const { html } = await res.json()
      await TemplateService.addTemplate({
        name: templateName.trim(),
        subject: campaign.subject ?? null,
        message: html,
        design_json: design,
        mjml,
      }, "email")
      toast.success("Template saved")
      setSaveTemplateOpen(false)
      setTemplateName("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template")
    } finally {
      setSavingTemplate(false)
    }
  }

  return <div className="min-h-screen bg-background">
    <div className="sticky top-0 bg-background/80 backdrop-blur z-10 border-b border-border py-4 px-6">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => router.push("/campaigns")}><ArrowLeft className="h-4 w-4" /></Button><Input className="w-auto min-w-[200px] max-w-[400px]" value={campaign.name || "Untitled campaign"} onChange={(e) => update({ name: e.target.value })} /><CampaignStatusBadge status={campaign.status} />{hasEdited && <span className="text-xs text-muted-foreground ml-2">{autosaveState === "saving" ? "Saving…" : autosaveState === "failed" ? "Save failed" : "Saved"}</span>}</div>
        <div className="flex gap-2"><Button variant="ghost" onClick={() => router.push("/campaigns")}>Finish later</Button><Button variant="brand" disabled={!canSend || !!campaign.scheduled_at} title={!canSend ? `Add: ${itemsMissing}` : ""} onClick={() => setSendConfirmOpen(true)}>Send</Button></div>
      </div>
    </div>
    <main className="max-w-4xl mx-auto px-6 py-8 space-y-3">
      <CardRow id="to" title="To" valid={toValid} ctaText="Add recipients" summary={toValid ? `${hasPrefillSnapshot?.recipientCount ?? allRecipientIds.length} recipients` : "Who are you sending this to?"} expandedCard={expandedCard} setExpandedCard={setExpandedCard}>{hasPrefillSnapshot ? <AudienceFilterSummaryCard snapshot={hasPrefillSnapshot} onPreview={() => setPreviewOpen(true)} onAdjust={() => router.push("/buyers")} onClear={() => { setHasPrefillSnapshot(null); update({ buyer_ids: [] }) }} /> : <GroupTreeSelector value={campaign.group_ids || []} onChange={(ids) => update({ group_ids: ids })} />}</CardRow>
      <CardRow id="from" title="From" valid={fromValid} ctaText="Add sender" summary={fromValid ? `${campaign.from_name} <${campaign.from_email}>` : "Who is sending this campaign?"} expandedCard={expandedCard} setExpandedCard={setExpandedCard}><div className="space-y-4"><p className="text-sm text-muted-foreground">Who is sending this campaign?</p><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><div className="flex items-center justify-between"><label className="text-sm font-medium">Name</label><span className="text-xs text-muted-foreground">{100 - (campaign.from_name?.length || 0)} left</span></div><Input maxLength={100} placeholder="GA Wholesale Homes" value={campaign.from_name || ""} onChange={(e) => update({ from_name: e.target.value })} /><p className="text-xs text-muted-foreground">Use something subscribers will instantly recognize, like your company name.</p></div><div className="space-y-2"><label className="text-sm font-medium">Email address</label><Input type="email" placeholder="homes@example.com" value={campaign.from_email || ""} onChange={(e) => update({ from_email: e.target.value })} /></div></div></div></CardRow>
      <CardRow id="subject" title="Subject" valid={subjectValid} ctaText="Add subject" summary={subjectValid ? campaign.subject : "What's the subject line?"} expandedCard={expandedCard} setExpandedCard={setExpandedCard}><div className="space-y-4"><p className="text-sm text-muted-foreground">What&apos;s the subject line for this campaign?</p><div className="space-y-2"><div className="flex items-center justify-between"><label className="text-sm font-medium">Subject <span className="font-normal text-muted-foreground">(Required)</span></label><span className="text-xs text-muted-foreground">{150 - (campaign.subject?.length || 0)} left</span></div><Input maxLength={150} value={campaign.subject || ""} onChange={(e) => update({ subject: e.target.value })} /><p className="text-xs text-muted-foreground">This is the first thing people see in their inbox.</p></div><div className="space-y-2"><div className="flex items-center justify-between"><label className="text-sm font-medium">Preview Text</label><span className="text-xs text-muted-foreground">{150 - ((campaign as any).preview_text?.length || 0)} left</span></div><Input maxLength={150} value={(campaign as any).preview_text || ""} onChange={(e) => update({ preview_text: e.target.value })} /><p className="text-xs text-muted-foreground">Preview text appears in the inbox after the subject line.</p></div></div></CardRow>
      <CardRow id="content" title="Content" valid={contentValid} ctaText="Design email" summary={contentValid ? `Email designed — ${(campaign.message || "").split(/\s+/).filter(Boolean).length} words` : "Design the email body"} expandedCard={expandedCard} setExpandedCard={setExpandedCard}><Button onClick={() => setContentSheetOpen(true)}>Open builder</Button></CardRow>
      <CardRow id="sendTime" title="Send time" valid={sendTimeValid} ctaText="Set send time" summary={campaign.scheduled_at ? `Scheduled for ${new Date(campaign.scheduled_at).toLocaleString()}` : "Send immediately when you click Send"} expandedCard={expandedCard} setExpandedCard={setExpandedCard}><SmsSendTimeCard scheduledAt={campaign.scheduled_at ?? null} onScheduledAtChange={(v) => update({ scheduled_at: v })} weekdayOnly={campaign.weekday_only ?? false} onWeekdayOnlyChange={(v) => update({ weekday_only: v })} runFrom={campaign.run_from ?? null} onRunFromChange={(v) => update({ run_from: v })} runUntil={campaign.run_until ?? null} onRunUntilChange={(v) => update({ run_until: v })} /></CardRow>
    </main>
    <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send campaign?</AlertDialogTitle>
          <AlertDialogDescription>
            This will send {hasPrefillSnapshot?.recipientCount ?? allRecipientIds.length} emails now. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-brand text-white hover:bg-brand/90" onClick={sendNow}>Send now</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Sheet open={contentSheetOpen} onOpenChange={setContentSheetOpen}><SheetContent className="w-full sm:max-w-full [&>button.absolute]:hidden"><div className="flex h-full flex-col"><div className="mb-4 flex justify-between"><Button variant="ghost" onClick={() => setContentSheetOpen(false)}>Cancel</Button><div className="flex items-center gap-2"><Button variant="outline" onClick={() => setSaveTemplateOpen(true)}>Save as template</Button><Button onClick={onSaveContent}>Save & Close</Button></div></div><div className="min-h-0 flex-1"><TemplaticalEmailEditor ref={editorRef} initialContent={campaign.design_json ?? null} onChange={(content) => update({ design_json: content })} /></div></div></SheetContent></Sheet>
    <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
        </DialogHeader>
        <Input placeholder="Template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>Cancel</Button>
          <Button onClick={saveAsTemplate} disabled={!templateName.trim() || savingTemplate}>{savingTemplate ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <RecipientsPreviewSheet open={previewOpen} onOpenChange={setPreviewOpen} buyerIds={hasPrefillSnapshot?.buyerIds || []} />
  </div>
}
