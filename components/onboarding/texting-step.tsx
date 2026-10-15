"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  Info,
  Loader2,
  Mail,
  MessageSquare,
  PartyPopper,
  Phone,
  Search,
  Share2,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { BUSINESS_TYPE_OPTIONS } from "@/components/onboarding/business-step"
import type { A2pAssembledState } from "@/lib/a2p-registration/types"
import type { VerificationMergedState } from "@/lib/business-verification/types"
import type { SetupSummary } from "@/lib/onboarding/outcome-types"
import type { CustomerIssue, CustomerIssueField } from "@/lib/org-twilio/issues"
import type { RegistrationStatus } from "@/lib/org-twilio/status"
import { REP_JOB_POSITIONS } from "@/lib/org-twilio/twilio-attributes"
import { cn } from "@/lib/utils"

// Texting setup, rendered by the registration stage: confirm details → pick a
// number → track carrier review (or reply YES / fix / get help). No carrier
// jargon anywhere; every wait says what happens next and how long it takes.

const POLL_MS = 30_000
const OTP_SENDER = "+1 (915) 278-2000"

export const FIX_HREF: Partial<Record<CustomerIssueField, string>> = {
  legal_name: "/getting-started/business",
  ein: "/getting-started/business",
  business_type: "/getting-started/business",
  address: "/getting-started/business",
  rep: "/getting-started/business",
  website: "/getting-started/website",
  samples: "#submit-panel",
  message_flow: "#submit-panel",
}

export function formatUsPhone(e164: string | null | undefined): string {
  const m = (e164 || "").match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164 || ""
}

export function maskMobile(phone: string | null | undefined): string {
  const d = (phone || "").replace(/\D/g, "")
  return d.length >= 4 ? `(•••) •••-${d.slice(-4)}` : "your mobile"
}

function areaCodeFrom(phone: string | null | undefined): string {
  const d = (phone || "").replace(/\D/g, "")
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d
  return ten.length === 10 ? ten.slice(0, 3) : ""
}

function formatDay(iso?: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

type Samples = A2pAssembledState["samples"]
const SAMPLE_KEYS = ["sample1", "sample2", "sample3", "sample4", "sample5"] as const

export function sampleError(text: string, brandNames: string[], required: boolean): string | null {
  const t = text.trim()
  if (!t) return required ? "Add this sample message." : null
  if (t.length < 20) return "Make it at least 20 characters."
  const names = brandNames.map((n) => n.toLowerCase()).filter(Boolean)
  if (names.length && !names.some((n) => t.toLowerCase().includes(n))) return `Include your business name (${brandNames[0]}).`
  return null
}

// ---- Shared bits ---------------------------------------------------------------

function BackToSetup() {
  const router = useRouter()
  return (
    <button type="button" onClick={() => router.push("/getting-started")} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Back to setup
    </button>
  )
}

function Header({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div>
      <BackToSetup />
      <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      {sub ? <p className="mt-1 text-sm text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

function Callout({ tone = "info", children }: { tone?: "info" | "warning" | "error"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
        tone === "info" && "border-border bg-muted/50 text-foreground",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
        tone === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
      )}
    >
      {tone === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function IssueList({ issues, onFixPanel }: { issues: CustomerIssue[]; onFixPanel?: () => void }) {
  return (
    <ul className="space-y-2">
      {issues.map((issue, i) => {
        const href = FIX_HREF[issue.field]
        return (
          <li key={i} className="flex items-start gap-3 rounded-lg border bg-card p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1 text-sm text-foreground">{issue.message}</span>
            {issue.fixable && href ? (
              href.startsWith("#") ? (
                <Button size="sm" variant="outline" onClick={onFixPanel}>
                  Fix
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link href={href}>Fix</Link>
                </Button>
              )
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

// ---- "See exactly what we'll submit" ---------------------------------------------

function SubmitPanel({ a2p, open, onOpenChange, onSaved }: { a2p: A2pAssembledState; open: boolean; onOpenChange: (v: boolean) => void; onSaved: (s: A2pAssembledState) => void }) {
  const [description, setDescription] = useState(a2p.program.campaignDescription)
  const [flow, setFlow] = useState(a2p.program.messageFlow)
  const [samples, setSamples] = useState<Samples>(a2p.samples)
  const [saving, setSaving] = useState(false)
  const dirty =
    description !== a2p.program.campaignDescription || flow !== a2p.program.messageFlow || SAMPLE_KEYS.some((k) => samples[k] !== a2p.samples[k])
  const errors = SAMPLE_KEYS.map((k, i) => sampleError(samples[k], a2p.brandNames, i < 2))
  const valid = errors.every((e) => !e) && description.trim().length >= 40 && flow.trim().length >= 40

  async function save() {
    setSaving(true)
    try {
      const res = await fetch("/api/a2p-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_description: description,
          message_flow: flow,
          sample_message_1: samples.sample1,
          sample_message_2: samples.sample2,
          sample_message_3: samples.sample3,
          sample_message_4: samples.sample4,
          sample_message_5: samples.sample5,
        }),
      })
      if (!res.ok) throw new Error()
      onSaved(await res.json())
      toast.success("Saved")
    } catch {
      toast.error("We couldn't save your changes. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div id="submit-panel" className="rounded-xl border bg-card">
      <button type="button" onClick={() => onOpenChange(!open)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-foreground" aria-expanded={open}>
        See exactly what we&apos;ll submit
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-4 border-t px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="tx-description">What you text about</Label>
            <Textarea id="tx-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            {description.trim().length < 40 ? <p className="text-xs font-medium text-destructive">Describe what you send in at least 40 characters.</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-flow">How buyers sign up for texts</Label>
            <Textarea id="tx-flow" rows={4} value={flow} onChange={(e) => setFlow(e.target.value)} />
            {flow.trim().length < 40 ? <p className="text-xs font-medium text-destructive">Describe how buyers sign up in at least 40 characters.</p> : null}
          </div>
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">Sample messages</div>
            <p className="text-xs text-muted-foreground">Each one includes your business name and is at least 20 characters. Samples 3–5 are optional.</p>
            {SAMPLE_KEYS.map((k, i) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={`tx-${k}`} className="text-xs">
                  Sample {i + 1}
                  {i >= 2 ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
                </Label>
                <Textarea id={`tx-${k}`} rows={2} value={samples[k]} onChange={(e) => setSamples((s) => ({ ...s, [k]: e.target.value }))} aria-invalid={Boolean(errors[i])} />
                {errors[i] ? <p className="text-xs font-medium text-destructive">{errors[i]}</p> : null}
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={save} disabled={!dirty || !valid || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      ) : null}
    </div>
  )
}

// ---- Screen 1: Confirm your details ------------------------------------------------

function DetailRow({ label, value, href, extra }: { label: string; value: string; href: string; extra?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-24 shrink-0 text-xs font-medium text-muted-foreground sm:w-28">{label}</div>
      <div className="min-w-0 flex-1 text-sm text-foreground">
        <span className="break-words">{value || <span className="text-muted-foreground">Missing</span>}</span>
        {extra ? <div className="mt-1">{extra}</div> : null}
      </div>
      <Link href={href} className="shrink-0 text-xs font-semibold text-brand hover:underline">
        Edit
      </Link>
    </div>
  )
}

type Choices = { businessType: string; jobPosition: string }

function ConfirmScreen({
  bv,
  a2p,
  setup,
  choices,
  onChoices,
  onA2pSaved,
  onContinue,
}: {
  bv: VerificationMergedState
  a2p: A2pAssembledState
  setup: SetupSummary | null
  choices: Choices
  onChoices: (c: Choices) => void
  onA2pSaved: (s: A2pAssembledState) => void
  onContinue: () => void
}) {
  const [panelOpen, setPanelOpen] = useState(false)
  const sole = bv.entity_type === "sole_proprietor"
  const business = setup?.outcomes.find((o) => o.key === "business")
  const website = setup?.outcomes.find((o) => o.key === "website")
  const blockers = [business, website].filter((o) => o && !o.ready)
  const samplesOk = SAMPLE_KEYS.every((k, i) => !sampleError(a2p.samples[k], a2p.brandNames, i < 2))

  if (blockers.length) {
    return (
      <div className="space-y-5">
        <Header title="Texting and calling" sub="Get a local number for texts and calls." />
        <Card className="space-y-3 p-5">
          <h2 className="text-base font-semibold text-foreground">Two quick things first</h2>
          <p className="text-sm text-muted-foreground">The carriers review your business and website before they approve texting. Finish these, then come back:</p>
          <div className="space-y-2">
            {blockers.map((o) => (
              <Link key={o!.key} href={o!.href} className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{o!.title}</span>
                  <span className="block text-xs text-muted-foreground">{o!.status}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-brand" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Header title="Confirm your details" sub="This is what the carriers will review. Check it once and you're done." />
      <Card className="divide-y px-4">
        <DetailRow label="Legal name" value={a2p.brand.legalDisplay || bv.legal_business_name} href="/getting-started/business" />
        {!sole ? <DetailRow label="EIN" value={a2p.brand.einMasked} href="/getting-started/business" /> : null}
        <DetailRow label="Address" value={a2p.brand.address} href="/getting-started/business" />
        <DetailRow
          label="Website"
          value={(a2p.program.optInUrl || "").replace(/^https?:\/\//, "")}
          href="/getting-started/website"
          extra={
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Privacy and terms included
            </span>
          }
        />
      </Card>

      {!sole ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tx-business-type">Business type</Label>
            <Select value={choices.businessType} onValueChange={(v) => onChoices({ ...choices, businessType: v })}>
              <SelectTrigger id="tx-business-type">
                <SelectValue placeholder="Choose one" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-title">Your title</Label>
            <Select value={choices.jobPosition} onValueChange={(v) => onChoices({ ...choices, jobPosition: v })}>
              <SelectTrigger id="tx-title">
                <SelectValue placeholder="Choose one" />
              </SelectTrigger>
              <SelectContent>
                {REP_JOB_POSITIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {!sole ? (
        <Callout>
          Your legal name has to match your IRS EIN letter exactly, including &lsquo;LLC&rsquo;. This is the #1 reason carriers reject a registration.
        </Callout>
      ) : (
        <Callout>Sole proprietors get 1 number and about 1,000 texts a day to T-Mobile. You can upgrade later.</Callout>
      )}

      <SubmitPanel a2p={a2p} open={panelOpen || !samplesOk} onOpenChange={setPanelOpen} onSaved={onA2pSaved} />

      <div className="flex justify-end">
        <Button variant="brand" onClick={onContinue} disabled={!samplesOk || (!sole && (!choices.businessType || !choices.jobPosition))}>
          Continue <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ---- Screen 2: Pick your local number ------------------------------------------------

type Available = { phoneNumber: string; friendly?: string; locality: string | null; region: string | null }

function NumberScreen({
  bv,
  choices,
  onBack,
  onSubmitted,
}: {
  bv: VerificationMergedState
  choices: Choices
  onBack: () => void
  onSubmitted: (s: RegistrationStatus) => void
}) {
  const [areaCode, setAreaCode] = useState(areaCodeFrom(bv.phone) || areaCodeFrom(bv.rep_phone))
  const [contains, setContains] = useState("")
  const [results, setResults] = useState<Available[] | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [searchNote, setSearchNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [issues, setIssues] = useState<CustomerIssue[]>([])
  const [submitError, setSubmitError] = useState("")

  const search = useCallback(async () => {
    if (!/^\d{3}$/.test(areaCode)) {
      setSearchError("Enter a 3-digit area code.")
      return
    }
    setSearching(true)
    setSearchError("")
    setSearchNote("")
    try {
      const qs = new URLSearchParams({ areaCode, ...(contains.trim() ? { contains: contains.trim() } : {}) })
      const res = await fetch(`/api/org-twilio/numbers/available?${qs}`)
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || "Number search isn't available right now. Try again.")
      const list = (Array.isArray(body?.results) ? body.results : []) as Available[]
      setResults(list)
      setPicked(list[0]?.phoneNumber ?? null)
      setShowAll(false)
      if (!list.length) setSearchError("Twilio has no numbers in this area right now. Try a nearby area code.")
      else if (body?.matchedBy && body.matchedBy !== "area_code") {
        setSearchNote(`No ${body.searchedAreaCode || areaCode} numbers are free right now. These are the closest available in your area.`)
      }
    } catch (e: any) {
      setSearchError(e?.message || "Number search isn't available right now. Try again.")
    } finally {
      setSearching(false)
    }
  }, [areaCode, contains])

  const searchedOnce = useRef(false)
  useEffect(() => {
    if (searchedOnce.current || !/^\d{3}$/.test(areaCode)) return
    searchedOnce.current = true
    void search()
  }, [areaCode, search])

  async function submit() {
    setSubmitting(true)
    setIssues([])
    setSubmitError("")
    try {
      const res = await fetch("/api/org-twilio/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandType: bv.entity_type === "sole_proprietor" ? "SOLE_PROPRIETOR" : "STANDARD",
          businessType: bv.entity_type === "sole_proprietor" ? undefined : choices.businessType,
          repTitle: bv.rep_title || choices.jobPosition,
          repJobPosition: bv.entity_type === "sole_proprietor" ? undefined : choices.jobPosition,
          repPhone: bv.rep_phone,
          desiredPhoneNumber: picked ?? undefined,
          areaCode: /^\d{3}$/.test(areaCode) ? areaCode : undefined,
        }),
      })
      const body = await res.json().catch(() => null)
      if (res.status === 422 && Array.isArray(body?.issues)) {
        setIssues(body.issues)
        return
      }
      if (!res.ok) throw new Error(body?.error || "We couldn't submit right now. Try again in a minute.")
      onSubmitted(body as RegistrationStatus)
    } catch (e: any) {
      setSubmitError(e?.message || "We couldn't submit right now. Try again in a minute.")
    } finally {
      setSubmitting(false)
    }
  }

  const visible = results ? (showAll ? results : results.slice(0, 3)) : []

  return (
    <div className="space-y-5">
      <Header title="Pick your local number" sub="Buyers see this number when you text and call." />
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="tx-area">Area code</Label>
            <Input id="tx-area" inputMode="numeric" maxLength={3} value={areaCode} onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-contains">
              Contains digits <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="tx-contains" inputMode="numeric" placeholder="e.g. 2020" value={contains} onChange={(e) => setContains(e.target.value.replace(/[^0-9*]/g, "").slice(0, 16))} />
          </div>
          <Button variant="outline" onClick={search} disabled={searching} aria-label="Search numbers">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {searchError ? <p className="text-sm text-destructive">{searchError}</p> : null}
        {searchNote ? <p className="text-sm text-muted-foreground">{searchNote}</p> : null}

        {visible.length ? (
          <div role="radiogroup" aria-label="Available numbers" className="space-y-2">
            {visible.map((n) => {
              const selected = picked === n.phoneNumber
              return (
                <button
                  key={n.phoneNumber}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPicked(n.phoneNumber)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    selected ? "border-brand bg-brand/5 ring-1 ring-brand/30" : "border-border hover:bg-muted/40",
                  )}
                >
                  <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", selected ? "border-brand" : "border-muted-foreground/40")}>
                    {selected ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-sm font-semibold text-foreground">{formatUsPhone(n.phoneNumber)}</span>
                    <span className="block text-xs text-muted-foreground">{[n.locality, n.region].filter(Boolean).join(", ") || "Local number"}</span>
                  </span>
                  <span className={cn("text-xs font-semibold", selected ? "text-brand" : "text-muted-foreground")}>{selected ? "Chosen" : "Choose"}</span>
                </button>
              )
            })}
            {results && results.length > 3 && !showAll ? (
              <button type="button" onClick={() => setShowAll(true)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                Show {results.length - 3} more
              </button>
            ) : null}
          </div>
        ) : null}

        <Callout>Your number is reserved when we approve your account. Calls work right away; texting turns on after carrier review.</Callout>
      </Card>

      {issues.length ? (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground">A few things to fix first</div>
          <IssueList issues={issues} onFixPanel={onBack} />
        </div>
      ) : null}
      {submitError ? <Callout tone="error">{submitError}</Callout> : null}

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button variant="brand" onClick={submit} disabled={submitting || !picked}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Submitting…" : "Submit to carriers"}
        </Button>
      </div>
    </div>
  )
}

// ---- Tracker ----------------------------------------------------------------------

const TRACKER_LABEL: Record<string, string> = {
  business: "Business verified",
  brand: "Business registration approved",
  verify_mobile: "Confirm your mobile",
  campaign: "Texting program in review",
}

function trackerLabel(step: RegistrationStatus["steps"][number], phone: string | null) {
  if (step.key === "number") return phone ? `${formatUsPhone(phone)} — calls work now` : "Your number"
  return TRACKER_LABEL[step.key] ?? step.label
}

function StepIcon({ state }: { state: string }) {
  if (state === "done") return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="h-3.5 w-3.5" /></span>
  if (state === "current") return <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-brand"><span className="h-2 w-2 animate-pulse rounded-full bg-brand" /></span>
  if (state === "issue") return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white"><AlertCircle className="h-3.5 w-3.5" /></span>
  return <Circle className="h-6 w-6 text-muted-foreground/40" />
}

function WhileYouWait() {
  const items = [
    { href: "/buyers", icon: Users, title: "Import buyers", body: "Paste a few or upload a spreadsheet." },
    { href: "/campaigns/new?type=email", icon: Mail, title: "Send an email blast", body: "Email works while texting is in review." },
    { href: "/websites", icon: Share2, title: "Share your buyer site", body: "Every sign-up joins your buyer list." },
  ]
  return (
    <div className="space-y-2.5">
      <div className="text-sm font-semibold text-foreground">While you wait</div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {items.map(({ href, icon: Icon, title, body }) => (
          <Link key={href} href={href} className="rounded-xl border bg-card p-3.5 transition-colors hover:bg-muted/40">
            <Icon className="mb-2 h-5 w-5 text-brand" />
            <div className="text-sm font-semibold text-foreground">{title}</div>
            <p className="text-xs text-muted-foreground">{body}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Tracker({ status }: { status: RegistrationStatus }) {
  const router = useRouter()
  const live = status.stage === "live"
  const pill =
    live ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" /> Live
      </span>
    ) : status.stage === "awaiting_approval" ? (
      <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
        Submitted — we&apos;re reviewing your account (usually within 1 business day)
      </span>
    ) : (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
        Usually a few business days
      </span>
    )

  return (
    <div className="space-y-5">
      {live ? (
        <div>
          <BackToSetup />
          <Card className="mt-3 space-y-3 border-emerald-200 p-5 text-center dark:border-emerald-900">
            <PartyPopper className="mx-auto h-8 w-8 text-brand" />
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Texting is live</h1>
            {status.phoneNumber ? <p className="font-mono text-lg font-semibold text-foreground">{formatUsPhone(status.phoneNumber)}</p> : null}
            <p className="text-sm text-muted-foreground">The carriers approved you. Your buyers can hear from you now.</p>
            <div>
              <Button variant="brand" onClick={() => router.push("/campaigns/new?type=sms")}>
                Send your first deal <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <Header title="Texting is on its way" sub="We submitted everything. Here's where things stand." />
      )}

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">Progress</span>
          {pill}
        </div>
        <ol className="space-y-3.5">
          {status.steps.map((step) => (
            <li key={step.key} className="flex items-start gap-3">
              <StepIcon state={step.state} />
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm font-medium", step.state === "waiting" ? "text-muted-foreground" : "text-foreground")}>{trackerLabel(step, status.phoneNumber)}</div>
                {step.state === "done" && step.at ? <div className="text-xs text-muted-foreground">{formatDay(step.at)}</div> : null}
                {step.state === "current" && step.key === "campaign" ? <div className="text-xs text-muted-foreground">Usually a few business days</div> : null}
              </div>
            </li>
          ))}
        </ol>
        {!live ? (
          <p className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> We&apos;ll email you as each step finishes. This page updates on its own.
          </p>
        ) : null}
      </Card>

      {!live ? <WhileYouWait /> : null}
    </div>
  )
}

// ---- Reply YES ---------------------------------------------------------------------

function VerifyMobile({ status, mobile, onStatus }: { status: RegistrationStatus; mobile: string; onStatus: (s: RegistrationStatus) => void }) {
  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function resend() {
    setSending(true)
    try {
      const res = await fetch("/api/org-twilio/otp/resend", { method: "POST" })
      const body = await res.json().catch(() => null)
      if (res.status === 429) toast("Wait a minute before asking for another text.")
      else if (!res.ok) throw new Error()
      else {
        toast.success("Sent. Check your phone.")
        onStatus(body)
      }
      setCooldown(60)
    } catch {
      toast.error("We couldn't resend the text. Try again in a minute.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      <Header title="One quick step" />
      <Card className="space-y-4 p-5 text-center">
        <MessageSquare className="mx-auto h-9 w-9 text-brand" />
        <h2 className="text-lg font-semibold text-foreground">Reply YES to the text we just sent to {maskMobile(mobile)}</h2>
        <p className="text-sm text-muted-foreground">
          It comes from <span className="font-semibold text-foreground">{OTP_SENDER}</span>. Reply within 24 hours and we&apos;ll take it from there.
        </p>
        <div>
          <Button variant="brand" onClick={resend} disabled={sending || cooldown > 0}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
            {cooldown > 0 ? `Resend text in ${cooldown}s` : "Resend text"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Didn&apos;t get it? Check that {formatUsPhone(mobile) || "your mobile"} can receive texts.</p>
      </Card>
      <Tracker status={status} />
    </div>
  )
}

// ---- Action needed / rejected ---------------------------------------------------------

function ActionRequired({ status, a2p, onA2pSaved, onStatus }: { status: RegistrationStatus; a2p: A2pAssembledState | null; onA2pSaved: (s: A2pAssembledState) => void; onStatus: (s: RegistrationStatus) => void }) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()

  async function resubmit() {
    setBusy(true)
    try {
      const res = await fetch("/api/org-twilio/resubmit", { method: "POST" })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error()
      onStatus(body)
      await queryClient.invalidateQueries({ queryKey: ["onboarding"] })
      toast.success("Resubmitted. Review usually takes a few business days.")
    } catch {
      toast.error("We couldn't resubmit right now. Try again in a minute.")
    } finally {
      setBusy(false)
    }
  }

  const many = status.issues.length > 1
  return (
    <div className="space-y-5">
      <Header title={many ? "A few quick fixes" : "One quick fix"} sub="The carriers need a change before they can finish. Fix it, then resubmit." />
      <IssueList
        issues={status.issues}
        onFixPanel={() => {
          setPanelOpen(true)
          setTimeout(() => document.getElementById("submit-panel")?.scrollIntoView({ behavior: "smooth" }), 50)
        }}
      />
      {a2p && status.issues.some((i) => i.field === "samples" || i.field === "message_flow") ? (
        <SubmitPanel a2p={a2p} open={panelOpen} onOpenChange={setPanelOpen} onSaved={onA2pSaved} />
      ) : null}
      {status.canResubmit ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">After you resubmit, review usually takes a few business days. We&apos;ll email you.</p>
          <Button variant="brand" onClick={resubmit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Resubmit
          </Button>
        </div>
      ) : (
        <Callout>
          Our team will help you finish.{" "}
          <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@listhit.io"}?subject=${encodeURIComponent("Help finishing texting setup")}`} className="font-semibold text-brand hover:underline">
            Email support
          </a>
        </Callout>
      )}
    </div>
  )
}

function Rejected() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@listhit.io"
  return (
    <div className="space-y-5">
      <Header title="Texting and calling" />
      <Card className="space-y-3 p-5">
        <h2 className="text-base font-semibold text-foreground">Let&apos;s finish this together</h2>
        <p className="text-sm text-muted-foreground">
          The carriers couldn&apos;t approve this registration as submitted. This happens, and our team can usually sort it out quickly. Email works normally in the meantime.
        </p>
        <Button asChild variant="brand">
          <a href={`mailto:${email}?subject=${encodeURIComponent("Help with texting setup")}`}>
            <Mail className="h-4 w-4" /> Contact support
          </a>
        </Button>
      </Card>
    </div>
  )
}

// ---- Page ------------------------------------------------------------------------------

type LoadState =
  | { kind: "loading" }
  | { kind: "blocked"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready" }

export function TextingStep() {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" })
  const [status, setStatus] = useState<RegistrationStatus | null>(null)
  const [bv, setBv] = useState<VerificationMergedState | null>(null)
  const [a2p, setA2p] = useState<A2pAssembledState | null>(null)
  const [setup, setSetup] = useState<SetupSummary | null>(null)
  const [screen, setScreen] = useState<1 | 2>(1)
  const [choices, setChoices] = useState<Choices>({ businessType: "", jobPosition: "" })
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const statusRes = await fetch("/api/org-twilio/status")
        if (statusRes.status === 403) {
          const body = await statusRes.json().catch(() => null)
          const pinned = /owner phone system/i.test(body?.error || "")
          if (active)
            setLoad({
              kind: "blocked",
              message: pinned ? "Texting and calling are live on your owner phone system. Nothing to set up here." : "Only the account owner or an admin can set up texting.",
            })
          return
        }
        if (!statusRes.ok) throw new Error()
        const [s, bvRes, a2pRes, setupRes] = await Promise.all([
          statusRes.json(),
          fetch("/api/business-verification"),
          fetch("/api/a2p-registration"),
          fetch("/api/onboarding"),
        ])
        const [bvBody, a2pBody, setupBody] = await Promise.all([
          bvRes.ok ? bvRes.json() : null,
          a2pRes.ok ? a2pRes.json() : null,
          setupRes.ok ? setupRes.json() : null,
        ])
        if (!active) return
        setStatus(s)
        setBv(bvBody)
        setA2p(a2pBody)
        setSetup(setupBody)
        setChoices({ businessType: bvBody?.business_type || "", jobPosition: bvBody?.rep_job_position || "" })
        setLoad({ kind: "ready" })
      } catch {
        if (active) setLoad({ kind: "error", message: "We couldn't load your texting setup. Try refreshing the page." })
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const stage = status?.stage
  const polling = Boolean(stage && stage !== "not_started" && stage !== "live" && stage !== "rejected")
  useEffect(() => {
    if (!polling) return
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return
      const res = await fetch("/api/org-twilio/status").catch(() => null)
      if (res?.ok) setStatus(await res.json())
    }, POLL_MS)
    return () => clearInterval(t)
  }, [polling])

  const onSubmitted = useCallback(
    (s: RegistrationStatus) => {
      setStatus(s)
      void queryClient.invalidateQueries({ queryKey: ["onboarding"] })
      toast.success("Submitted. We'll email you at each step.")
    },
    [queryClient],
  )

  const body = useMemo(() => {
    if (load.kind === "loading") {
      return (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )
    }
    if (load.kind !== "ready") {
      return (
        <div className="space-y-5">
          <Header title="Texting and calling" />
          <Callout tone={load.kind === "error" ? "error" : "info"}>{load.message}</Callout>
        </div>
      )
    }
    if (!status) return null
    switch (status.stage) {
      case "not_started":
        if (!bv || !a2p) return <Callout tone="error">We couldn&apos;t load your business details. Try refreshing the page.</Callout>
        return screen === 1 ? (
          <ConfirmScreen bv={bv} a2p={a2p} setup={setup} choices={choices} onChoices={setChoices} onA2pSaved={setA2p} onContinue={() => setScreen(2)} />
        ) : (
          <NumberScreen bv={bv} choices={choices} onBack={() => setScreen(1)} onSubmitted={onSubmitted} />
        )
      case "verify_mobile":
        return <VerifyMobile status={status} mobile={bv?.rep_phone || ""} onStatus={setStatus} />
      case "action_required":
        return <ActionRequired status={status} a2p={a2p} onA2pSaved={setA2p} onStatus={setStatus} />
      case "rejected":
        return <Rejected />
      default:
        return <Tracker status={status} />
    }
  }, [load, status, bv, a2p, setup, screen, choices, onSubmitted])

  return <div className="mx-auto max-w-2xl space-y-5 pb-10">{body}</div>
}
