"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Ban, CheckCircle2, Circle, TestTube2, Users, Wand2 } from "lucide-react"
import { toast } from "sonner"
import CampaignStatusBadge from "@/components/campaigns/campaign-status-badge"
import AudienceFilterSummaryCard from "@/components/campaigns/audience-filter-summary-card"
import RecipientsPreviewSheet from "@/components/campaigns/recipients-preview-sheet"
import CampaignAudienceStep from "@/components/campaigns/campaign-audience-step"
import { useCampaignAudience } from "@/components/segments/use-campaign-audience"
import SmsComposerPanel from "@/components/campaigns/sms-composer-panel"
import SmsMediaCard from "@/components/campaigns/sms-media-card"
import SmsSendTimeCard from "@/components/campaigns/sms-send-time-card"
import CampaignPropertySelector from "@/components/campaigns/campaign-property-selector"
import { readAudienceSnapshot, clearAudienceSnapshot, type CampaignAudienceSnapshot } from "@/lib/campaign-audience"
import { calculateSmsSegments } from "@/lib/sms-utils"
import { applyShortLinkPreview, fetchShortLinkConfig, type ShortLinkConfig } from "@/lib/shortlink-preview"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

// From section: pick which campaign market's number pool sends this SMS campaign,
// and explain the real per-recipient routing (no more "15 numbers rotate" fiction).
function SmsFromSection({ campaignMarkets, marketsLoading, selectedMarketId, onSelect }: {
  campaignMarkets: any[]
  marketsLoading: boolean
  selectedMarketId: string | null
  onSelect: (id: string) => void
}) {
  if (marketsLoading) {
    return <p className="text-sm text-muted-foreground">Loading sending market…</p>
  }
  if (campaignMarkets.length === 0) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">SMS campaigns send from a campaign market&apos;s pool of numbers, and you don&apos;t have one yet.</p>
        <Link className="font-medium text-brand underline" href="/settings/markets">Create a campaign market to send SMS →</Link>
      </div>
    )
  }

  const single = campaignMarkets.length === 1
  const selected = campaignMarkets.find((m) => m.id === selectedMarketId) ?? (single ? campaignMarkets[0] : null)
  const count = selected?.numberCount ?? 0

  return (
    <div className="space-y-4 text-sm">
      {single ? (
        <p className="text-muted-foreground">
          Sending from <span className="font-medium text-foreground">{selected?.name}</span> · {count} {count === 1 ? "number" : "numbers"}.
        </p>
      ) : (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Sending from</label>
          <Select value={selectedMarketId ?? ""} onValueChange={onSelect}>
            <SelectTrigger className="w-full sm:w-[320px]"><SelectValue placeholder="Choose a sending market" /></SelectTrigger>
            <SelectContent>
              {campaignMarkets.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name} · {m.numberCount ?? 0} numbers</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!selectedMarketId && <p className="text-xs text-amber-600 dark:text-amber-500">Choose a sending market.</p>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-1.5 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10"><Users className="h-3.5 w-3.5 text-brand" /></div><span className="text-xs font-medium">Existing conversation</span></div>
          <p className="text-xs text-muted-foreground">The buyer stays on the number they last texted with — no surprise area-code switches mid-thread.</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-1.5 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10"><Wand2 className="h-3.5 w-3.5 text-brand" /></div><span className="text-xs font-medium">First contact</span></div>
          <p className="text-xs text-muted-foreground">A cold recipient is sent from the least-recently-used SMS number in {selected?.name ?? "the selected market"}, rotating across its {count} {count === 1 ? "number" : "numbers"}.</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-1.5 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10"><Ban className="h-3.5 w-3.5 text-brand" /></div><span className="text-xs font-medium">No pool</span></div>
          <p className="text-xs text-muted-foreground">If the market has no SMS-enabled numbers, the send is blocked — it never falls back to a main line.</p>
        </div>
      </div>
    </div>
  )
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
  const [audience, setAudience] = useState<{ count: number; sampleIds: string[] } | null>(null)
  const [audienceLoading, setAudienceLoading] = useState(false)
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [shortConfig, setShortConfig] = useState<ShortLinkConfig>({ domain: "", slugLength: 7, configured: false })
  const audienceSeq = useRef(0)
  const audienceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const parsedTestPhone = useMemo(() => {
    if (!testPhone.trim()) return null
    return formatPhoneE164(testPhone)
  }, [testPhone])
  const isTestPhoneInvalid = testPhone.trim().length > 0 && !parsedTestPhone
  const campaignGroupIdsKey = useMemo(() => JSON.stringify(campaign.group_ids || []), [campaign.group_ids])
  const campaignBuyerIdsKey = useMemo(() => JSON.stringify(campaign.buyer_ids || []), [campaign.buyer_ids])

  // Resolve the audience count server-side (the same resolver the send path uses),
  // debounced and sequence-guarded so a stale response can't overwrite a newer one.
  useEffect(() => {
    const groupIds = JSON.parse(campaignGroupIdsKey) as string[]
    const buyerIds = JSON.parse(campaignBuyerIdsKey) as string[]
    if (!groupIds.length && !buyerIds.length) {
      setAudience({ count: 0, sampleIds: [] })
      setAudienceLoading(false)
      return
    }
    if (audienceTimer.current) clearTimeout(audienceTimer.current)
    const mySeq = ++audienceSeq.current
    setAudienceLoading(true)
    audienceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/campaigns/audience/count", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel: "sms", buyerIds, groupIds }),
        })
        const body = await res.json().catch(() => ({}))
        if (mySeq !== audienceSeq.current) return // a newer change superseded this one
        if (!res.ok) throw new Error(body?.error || "audience count failed")
        setAudience({ count: body.count ?? 0, sampleIds: body.sampleIds ?? [] })
      } catch (err) {
        if (mySeq !== audienceSeq.current) return
        console.error("[audience-count] fetch failed", err)
        setAudience(null) // do not toast — this fires on near-keystroke changes
      } finally {
        if (mySeq === audienceSeq.current) setAudienceLoading(false)
      }
    }, 400)
    return () => { if (audienceTimer.current) clearTimeout(audienceTimer.current) }
  }, [campaignGroupIdsKey, campaignBuyerIdsKey])

  useEffect(() => setTestPhone(localStorage.getItem("listhit:smsTestNumber") ?? ""), [])

  useEffect(() => {
    let mounted = true
    fetchShortLinkConfig().then((c) => { if (mounted) setShortConfig(c) }).catch(() => {})
    return () => { mounted = false }
  }, [])

  // Campaign-purpose markets are the SMS sending pools. `null` = still loading.
  const [markets, setMarkets] = useState<any[] | null>(null)
  useEffect(() => {
    let mounted = true
    fetch("/api/markets")
      .then((r) => r.json())
      .then((d) => { if (mounted) setMarkets(d?.ok ? (d.markets ?? []) : []) })
      .catch(() => { if (mounted) setMarkets([]) })
    return () => { mounted = false }
  }, [])
  const marketsLoading = markets === null
  const campaignMarkets = useMemo(() => (markets ?? []).filter((m: any) => m.purpose === "campaign"), [markets])
  // Effective market for display: explicit choice, or the sole campaign market.
  const selectedMarketId: string | null =
    campaign.sending_market_id ?? (campaignMarkets.length === 1 ? campaignMarkets[0]?.id ?? null : null)
  const selectedMarket = campaignMarkets.find((m: any) => m.id === selectedMarketId) ?? null

  const mediaUrls = parseMediaUrls(campaign.media_url)
  const shortenLinks = campaign.shorten_links ?? true
  const shortenActive = shortenLinks && shortConfig.configured
  const effectiveMessage = shortenActive
    ? applyShortLinkPreview(campaign.message ?? "", shortConfig.domain, shortConfig.slugLength).effective
    : (campaign.message ?? "")
  const segmentInfo = calculateSmsSegments(effectiveMessage)
  // Prefer the resolved audience count; fall back to a prefill snapshot, then to
  // legacy buyer_ids/group_ids for campaigns created before the picker.
  const recipientCount =
    campaign.audience_preview_count ?? hasPrefillSnapshot?.recipientCount ?? audience?.count ?? 0
  // The server count must have loaded before an operator can dispatch — never send
  // against a count that failed to resolve.
  const audienceUnknown =
    audienceLoading || (audience === null && !campaign.audience_preview_count && !hasPrefillSnapshot)
  const toValid = recipientCount > 0 || !!hasPrefillSnapshot
  // From is valid once a sending pool is determinable: single campaign market
  // (auto), or an explicit choice when multiple exist. Zero markets blocks send.
  // While markets load, stay optimistic — the server resolver is the real gate.
  const fromValid = marketsLoading
    ? true
    : campaignMarkets.length === 0
      ? false
      : campaignMarkets.length === 1
        ? true
        : Boolean(campaign.sending_market_id)
  const fromSummary = marketsLoading
    ? "Loading sending market…"
    : campaignMarkets.length === 0
      ? "No campaign market — SMS can't send"
      : selectedMarket
        ? `Sending from ${selectedMarket.name} · ${selectedMarket.numberCount ?? 0} numbers`
        : "Choose a sending market"
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
  const { audienceSelection, handleAudienceChange } = useCampaignAudience(campaign, "sms", update)
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
      body: JSON.stringify({ campaignId: campaign.id, expectedCount: recipientCount }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok && body?.reason === "audience_count_mismatch") {
      toast.error(`Audience changed — it now resolves to ${body.resolved} recipients, not ${body.expected}. Reopen the campaign and check the audience.`)
      setSendConfirmOpen(false)
      return
    }
    if (res.ok) {
      toast.success("Campaign sending…")
      router.push(`/campaigns/${campaign.id}`)
    } else {
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
    <div className="sticky top-0 bg-background/80 backdrop-blur z-10 border-b border-border py-4 px-6"><div className="max-w-4xl mx-auto flex items-center justify-between"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => router.push("/campaigns")}><ArrowLeft className="h-4 w-4" /></Button><Input className="w-auto min-w-[200px] max-w-[400px]" value={campaign.name || "Untitled campaign"} onChange={(e) => update({ name: e.target.value })} /><CampaignStatusBadge status={campaign.status} />{hasEdited && <span className="text-xs text-muted-foreground">{autosaveState === "saving" ? "Saving…" : autosaveState === "failed" ? "Save failed" : "Saved"}</span>}</div><div className="flex items-start gap-2"><div><Input className="h-9 w-[130px]" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+1 (770) 555-0123" />{isTestPhoneInvalid && <p className="mt-1 text-xs text-red-500">Enter a valid US phone number</p>}</div><Can permission="campaigns.send_sms"><Button variant="outline" size="sm" disabled={!testPhone.trim() || isTestPhoneInvalid || sendingTest || !campaign.message?.trim()} onClick={sendTest}><TestTube2 className="h-4 w-4" />Send test</Button></Can><Can permission="campaigns.send_sms"><Button variant="brand" disabled={!canSend || !!campaign.scheduled_at || audienceUnknown} onClick={() => setSendConfirmOpen(true)}>Send</Button></Can></div></div></div>
    <main className="max-w-4xl mx-auto px-6 py-8 space-y-3">
      <CardRow expandedCard={expandedCard} setExpandedCard={setExpandedCard} id="to" title="To" valid={toValid} ctaText="Add recipients" summary={toValid ? `${recipientCount} recipients` : "Who are you sending this to?"}>{hasPrefillSnapshot ? <AudienceFilterSummaryCard snapshot={hasPrefillSnapshot} onPreview={() => setPreviewOpen(true)} onAdjust={() => router.push("/buyers")} onClear={() => { setHasPrefillSnapshot(null); update({ buyer_ids: [] }) }} /> : (
        <CampaignAudienceStep channel="sms" campaign={campaign} update={update} audienceSelection={audienceSelection} onAudienceChange={handleAudienceChange} recipientCount={recipientCount} />
      )}</CardRow>
      <CardRow expandedCard={expandedCard} setExpandedCard={setExpandedCard} id="from" title="From" valid={fromValid} ctaText="Choose sender" summary={fromSummary}><SmsFromSection campaignMarkets={campaignMarkets} marketsLoading={marketsLoading} selectedMarketId={selectedMarketId} onSelect={(id) => update({ sending_market_id: id })} /></CardRow>
      <CardRow expandedCard={expandedCard} setExpandedCard={setExpandedCard} id="content" title="Content" valid={contentValid} ctaText="Compose SMS" summary={campaign.message?.trim() ? `Message ready — ${segmentInfo.segments} segments` : "Write your message"}><SmsComposerPanel message={campaign.message || ""} onMessageChange={(value) => update({ message: value })} buyerIds={audience?.sampleIds ?? []} recipientCount={recipientCount} mediaUrls={mediaUrls} shortenLinks={shortenLinks} onShortenLinksChange={(value) => update({ shorten_links: value })} shortConfig={shortConfig} /></CardRow>
      <CardRow expandedCard={expandedCard} setExpandedCard={setExpandedCard} id="media" title="Media" valid={true} ctaText="Add media" summary={mediaUrls.length ? `${mediaUrls.length} attachment(s)` : "Optional MMS attachments"}><SmsMediaCard mediaUrls={mediaUrls} onChange={(urls) => update({ media_url: JSON.stringify(urls) })} subject={campaign.subject} onSubjectChange={(value) => update({ subject: value })} /></CardRow>
      <CardRow expandedCard={expandedCard} setExpandedCard={setExpandedCard} id="property" title="Property" valid={true} ctaText="Attribute property" summary={campaign.property_id ? "Campaign cost attributed to a property" : "Optional property attribution"}><CampaignPropertySelector value={campaign.property_id ?? null} onChange={(property_id) => update({ property_id })} /></CardRow>
      <CardRow expandedCard={expandedCard} setExpandedCard={setExpandedCard} id="sendTime" title="Send time" valid={sendTimeValid} ctaText="Set send time" summary={campaign.scheduled_at ? `Scheduled for ${new Date(campaign.scheduled_at).toLocaleString()}` : "Send immediately when you click Send"}><SmsSendTimeCard scheduledAt={campaign.scheduled_at} onScheduledAtChange={(value) => update({ scheduled_at: value })} weekdayOnly={campaign.weekday_only} onWeekdayOnlyChange={(value) => update({ weekday_only: value })} runFrom={campaign.run_from} onRunFromChange={(value) => update({ run_from: value })} runUntil={campaign.run_until} onRunUntilChange={(value) => update({ run_until: value })} /></CardRow>
    </main>
    <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send campaign?</AlertDialogTitle>
          <AlertDialogDescription>
            This will send {recipientCount.toLocaleString()} SMS {recipientCount === 1 ? "message" : "messages"} now. This can&apos;t be undone.
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
