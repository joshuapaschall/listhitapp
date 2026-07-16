"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react"
import type { TemplateContent } from "@templatical/editor"
import { createDefaultTemplateContent, createHtmlBlock } from "@templatical/types"
import { toast } from "sonner"
import CampaignStatusBadge from "@/components/campaigns/campaign-status-badge"
import AudienceFilterSummaryCard from "@/components/campaigns/audience-filter-summary-card"
import RecipientsPreviewSheet from "@/components/campaigns/recipients-preview-sheet"
import dynamic from "next/dynamic"
import type { TemplaticalEditor } from "@/components/campaigns/email/templatical-email-editor"
import EmailTemplatePicker, { type EmailPickResult } from "@/components/campaigns/email/email-template-picker"
import CampaignAudienceStep from "@/components/campaigns/campaign-audience-step"
import { useCampaignAudience } from "@/components/segments/use-campaign-audience"
import { readAudienceSnapshot, clearAudienceSnapshot, type CampaignAudienceSnapshot } from "@/lib/campaign-audience"
import { emptyEmailTemplate } from "@/lib/email-templates"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { BuyerService } from "@/services/buyer-service"
import { TemplateService } from "@/services/template-service"
import SmsSendTimeCard from "@/components/campaigns/sms-send-time-card"
import CampaignPropertySelector from "@/components/campaigns/campaign-property-selector"
import { Can } from "@/components/auth/Can"


const TemplaticalEmailEditor = dynamic(() => import("@/components/campaigns/email/templatical-email-editor"), {
  ssr: false,
})

type EmailSenderOption = {
  id: string
  from_email: string
  from_name: string | null
  reply_to: string | null
  is_default: boolean | null
  domain_id: string
}

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
  const [expandedCard, setExpandedCard] = useState<"to"|"from"|"subject"|"sendTime"|"content"|"property"|null>(null)
  const [autosaveState, setAutosaveState] = useState<"idle"|"saving"|"saved"|"failed">("idle")
  const [hasEdited, setHasEdited] = useState(false)
  const [hasPrefillSnapshot, setHasPrefillSnapshot] = useState<CampaignAudienceSnapshot | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [contentSheetOpen, setContentSheetOpen] = useState(false)
  const [builderStep, setBuilderStep] = useState<"picker" | "editor">("picker")
  const [pickerBucket, setPickerBucket] = useState<"basic" | "fully-designed" | undefined>(undefined)
  const [pickerKey, setPickerKey] = useState(0)
  const [editorSeed, setEditorSeed] = useState<TemplateContent | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [editorInstance, setEditorInstance] = useState<TemplaticalEditor | null>(null)
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [changeTemplateOpen, setChangeTemplateOpen] = useState(false)
  const isPickerStep = builderStep === "picker"
  const isEditorStep = builderStep === "editor"
  const pickerVisible = builderStep === "picker"
  const editorVisible = builderStep === "editor"
  const currentBuilderStep = builderStep
  const [templateName, setTemplateName] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [resolvedGroupBuyerIds, setResolvedGroupBuyerIds] = useState<string[]>([])
  const [emailSenders, setEmailSenders] = useState<EmailSenderOption[]>([])
  const [sendersLoaded, setSendersLoaded] = useState(false)
  const initialFromEmailRef = useRef<string | null>(campaign.from_email ?? null)
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

  const selectedSender = useMemo(
    () => emailSenders.find((sender) => sender.from_email === campaign.from_email),
    [campaign.from_email, emailSenders],
  )
  const hasLegacySender = sendersLoaded && !!campaign.from_email && !selectedSender
  // Prefer the resolved audience count; fall back to a prefill snapshot, then to
  // legacy buyer_ids/group_ids for campaigns created before the picker.
  const recipientCount =
    campaign.audience_preview_count ?? hasPrefillSnapshot?.recipientCount ?? allRecipientIds.length
  const toValid =
    recipientCount > 0 ||
    ((campaign.group_ids?.length || 0) + (campaign.buyer_ids?.length || 0)) > 0 ||
    !!hasPrefillSnapshot
  const fromValid = !!selectedSender
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
  const { audienceSelection, handleAudienceChange } = useCampaignAudience(campaign, "email", update)

  useEffect(() => {
    if (campaign.channel !== "email") return

    let alive = true
    fetch("/api/email/senders")
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok || !body?.ok) {
          throw new Error(body?.error || "Failed to load verified senders")
        }
        return (body.senders || []) as EmailSenderOption[]
      })
      .then((senders) => {
        if (!alive) return
        setEmailSenders(senders)
        setSendersLoaded(true)

        const initialFromEmail = initialFromEmailRef.current
        const currentFromEmail = initialFromEmail?.trim().toLowerCase()
        if (currentFromEmail) {
          const matchingSender = senders.find((sender) => sender.from_email === currentFromEmail)
          if (matchingSender && matchingSender.from_email !== initialFromEmail) {
            update({ from_email: matchingSender.from_email })
          }
          return
        }

        const defaultSender = senders.find((sender) => sender.is_default) || senders[0]
        if (defaultSender) {
          update({
            from_name: defaultSender.from_name || "",
            from_email: defaultSender.from_email,
          })
        }
      })
      .catch((error) => {
        if (!alive) return
        setSendersLoaded(true)
        toast.error(error?.message || "Failed to load verified senders")
      })

    return () => { alive = false }
  }, [campaign.channel])

  const itemsMissing = [!toValid && "Recipients", !fromValid && "Sender", !subjectValid && "Subject", !contentValid && "Content"].filter(Boolean).join(", ")

  const hasExistingDesign = () =>
    !!campaign.design_json &&
    Array.isArray(campaign.design_json.blocks) &&
    campaign.design_json.blocks.length > 0

  const openBuilder = () => {
    if (hasExistingDesign()) {
      setEditorSeed(campaign.design_json as TemplateContent)
      setEditorInstance(null)
      setEditorKey((k) => k + 1)
      setBuilderStep("editor")
    } else {
      setPickerBucket(undefined)
      setBuilderStep("picker")
    }
    setContentSheetOpen(true)
  }

  const handlePick = (r: EmailPickResult) => {
    let content: TemplateContent
    if (r.kind === "scratch") {
      content = emptyEmailTemplate()
    } else if (r.kind === "html") {
      const c = createDefaultTemplateContent("Inter, Helvetica, Arial, sans-serif")
      c.blocks = [createHtmlBlock({ content: "<!-- Paste or write your HTML here -->" })]
      content = c
    } else if (r.kind === "saved") {
      content = r.record.design_json as TemplateContent
      if (r.record.subject && !campaign.subject?.trim()) update({ subject: r.record.subject })
    } else {
      content = r.def.build()
      if (r.def.defaultSubject && !campaign.subject?.trim()) update({ subject: r.def.defaultSubject })
    }
    setEditorSeed(content)
    setEditorInstance(null)
    setEditorKey((k) => k + 1)
    update({ design_json: content })
    setBuilderStep("editor")
  }

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
    const response = await fetch("/api/campaigns/send-now", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    const editor = editorInstance
    if (!editor) {
      toast.error("Editor not ready — try again in a moment")
      return
    }

    try {
      const design = editor.getContent()

      if (!design || !Array.isArray(design.blocks) || design.blocks.length === 0) {
        toast.error("Nothing to save yet — add content first")
        return
      }

      const res = await fetch("/api/campaigns/email/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.errors?.join("; ") || body?.error || "Failed to render email")
      }

      const { html, mjml } = await res.json()
      update({ message: html, design_json: design, mjml })
      setContentSheetOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save content"
      toast.error(message)
    }
  }

  const saveAsTemplate = async () => {
    const editor = editorInstance
    if (!editor) {
      toast.error("Editor not ready — try again")
      return
    }
    setSavingTemplate(true)
    try {
      const design = editor.getContent()
      if (!design || !Array.isArray(design.blocks) || design.blocks.length === 0) {
        toast.error("Nothing to save yet — add content first")
        return
      }
      const res = await fetch("/api/campaigns/email/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.errors?.join("; ") || body?.error || "Failed to render email")
      }
      const { html, mjml } = await res.json()
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
        <div className="flex gap-2"><Button variant="ghost" onClick={() => router.push("/campaigns")}>Finish later</Button><Can permission="campaigns.send_email"><Button variant="brand" disabled={!canSend || !!campaign.scheduled_at} title={!canSend ? `Add: ${itemsMissing}` : ""} onClick={() => setSendConfirmOpen(true)}>Send</Button></Can></div>
      </div>
    </div>
    <main className="max-w-4xl mx-auto px-6 py-8 space-y-3">
      <CardRow id="to" title="To" valid={toValid} ctaText="Add recipients" summary={toValid ? `${recipientCount} recipients` : "Who are you sending this to?"} expandedCard={expandedCard} setExpandedCard={setExpandedCard}>{hasPrefillSnapshot ? <AudienceFilterSummaryCard snapshot={hasPrefillSnapshot} onPreview={() => setPreviewOpen(true)} onAdjust={() => router.push("/buyers")} onClear={() => { setHasPrefillSnapshot(null); update({ buyer_ids: [] }) }} /> : (
        <CampaignAudienceStep channel="email" campaign={campaign} update={update} audienceSelection={audienceSelection} onAudienceChange={handleAudienceChange} recipientCount={recipientCount} />
      )}</CardRow>
      <CardRow id="from" title="From" valid={fromValid} ctaText="Add sender" summary={fromValid && selectedSender ? `${selectedSender.from_name || selectedSender.from_email} <${selectedSender.from_email}>` : "Who is sending this campaign?"} expandedCard={expandedCard} setExpandedCard={setExpandedCard}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Choose a verified sender for this campaign.</p>
          {hasLegacySender && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This sender isn&apos;t verified and won&apos;t send. Pick a verified sender below.
            </div>
          )}
          {emailSenders.length > 0 ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Verified sender</label>
              <Select
                value={selectedSender?.id || ""}
                onValueChange={(senderId) => {
                  const sender = emailSenders.find((option) => option.id === senderId)
                  if (!sender) return
                  update({ from_name: sender.from_name || "", from_email: sender.from_email })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a verified sender" />
                </SelectTrigger>
                <SelectContent>
                  {emailSenders.map((sender) => (
                    <SelectItem key={sender.id} value={sender.id}>
                      {sender.from_name || sender.from_email} — {sender.from_email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSender && (
                <p className="text-xs text-muted-foreground">
                  Replies go to {selectedSender.reply_to || selectedSender.from_email}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Reply-to is configured per from-address in Settings → Sending Domains.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              <Link href="/settings/email-domains" className="font-medium text-brand hover:underline">
                Add and verify a sending domain to choose a from-address.
              </Link>
            </div>
          )}
        </div>
      </CardRow>
      <CardRow id="subject" title="Subject" valid={subjectValid} ctaText="Add subject" summary={subjectValid ? campaign.subject : "What's the subject line?"} expandedCard={expandedCard} setExpandedCard={setExpandedCard}><div className="space-y-4"><p className="text-sm text-muted-foreground">What&apos;s the subject line for this campaign?</p><div className="space-y-2"><div className="flex items-center justify-between"><label className="text-sm font-medium">Subject <span className="font-normal text-muted-foreground">(Required)</span></label><span className="text-xs text-muted-foreground">{150 - (campaign.subject?.length || 0)} left</span></div><Input maxLength={150} value={campaign.subject || ""} onChange={(e) => update({ subject: e.target.value })} /><p className="text-xs text-muted-foreground">This is the first thing people see in their inbox.</p></div><div className="space-y-2"><div className="flex items-center justify-between"><label className="text-sm font-medium">Preview Text</label><span className="text-xs text-muted-foreground">{150 - ((campaign as any).preview_text?.length || 0)} left</span></div><Input maxLength={150} value={(campaign as any).preview_text || ""} onChange={(e) => update({ preview_text: e.target.value })} /><p className="text-xs text-muted-foreground">Preview text appears in the inbox after the subject line.</p></div></div></CardRow>
      <CardRow id="content" title="Content" valid={contentValid} ctaText="Design email" summary={contentValid ? `Email designed — ${(campaign.message || "").split(/\s+/).filter(Boolean).length} words` : "Design the email body"} expandedCard={expandedCard} setExpandedCard={setExpandedCard}><Button onClick={openBuilder}>Open builder</Button></CardRow>
      <CardRow id="property" title="Property" valid={true} ctaText="Attribute property" summary={campaign.property_id ? "Campaign cost attributed to a property" : "Optional property attribution"} expandedCard={expandedCard} setExpandedCard={setExpandedCard}><CampaignPropertySelector value={campaign.property_id ?? null} onChange={(property_id) => update({ property_id })} /></CardRow>
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
          <Can permission="campaigns.send_email"><AlertDialogAction className="bg-brand text-white hover:bg-brand/90" onClick={sendNow}>Send now</AlertDialogAction></Can>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Sheet open={contentSheetOpen} onOpenChange={setContentSheetOpen}>
      <SheetContent className="w-full p-0 sm:max-w-full [&>button.absolute]:hidden" data-builder-step={currentBuilderStep}>
        {isPickerStep ? (
          <div className="h-full overflow-auto px-6 py-8" data-step={pickerVisible ? "picker" : "hidden"}>
            <EmailTemplatePicker key={pickerKey} initialBucket={pickerBucket} onPick={handlePick} onClose={() => setContentSheetOpen(false)} />
          </div>
        ) : (
          <div className="flex h-full flex-col p-6" data-step={editorVisible ? "editor" : "hidden"}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setContentSheetOpen(false)}>Cancel</Button>
                <Button variant="ghost" onClick={() => setChangeTemplateOpen(true)}>Change template</Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setSaveTemplateOpen(true)}>Save as template</Button>
                <Button onClick={onSaveContent} disabled={!isEditorStep || !editorInstance}>
                  {isEditorStep && !editorInstance ? "Loading editor…" : "Save & Close"}
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <TemplaticalEmailEditor
                key={editorKey}
                initialContent={editorSeed}
                onReady={setEditorInstance}
                onChange={(content) => update({ design_json: content })}
              />
            </div>
          </div>
        )}
        {changeTemplateOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl">
              <h3 className="text-lg font-semibold">Change template?</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This replaces your current design with a different starting point. Unsaved changes in the current design will be lost.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setChangeTemplateOpen(false)}>Keep editing</Button>
                <Button
                  className="bg-brand text-brand-fg hover:bg-brand-hover"
                  onClick={() => {
                    setChangeTemplateOpen(false)
                    setPickerBucket("fully-designed")
                    setPickerKey((k) => k + 1)
                    setBuilderStep("picker")
                  }}
                >
                  Choose new template
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
    <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
        </DialogHeader>
        <Input placeholder="Template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>Cancel</Button>
          <Button onClick={saveAsTemplate} disabled={!templateName.trim() || savingTemplate || !editorInstance}>{savingTemplate ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <RecipientsPreviewSheet open={previewOpen} onOpenChange={setPreviewOpen} buyerIds={hasPrefillSnapshot?.buyerIds || []} />
  </div>
}
