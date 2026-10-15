"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ArrowLeft, Building2, Check, HelpCircle, Info, Loader2, Upload, User, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { EntityType, VerificationFormState } from "@/lib/business-verification/types"
import { REP_JOB_POSITIONS } from "@/lib/org-twilio/twilio-attributes"
import { cn } from "@/lib/utils"

// One form for the business behind the account. Writes the organization (name,
// address, phone) and the business verification record together, so every
// other screen reads the same facts.

export const BUSINESS_TYPE_OPTIONS = [
  { value: "Limited Liability Corporation", label: "LLC" },
  { value: "Corporation", label: "Corporation" },
  { value: "Partnership", label: "Partnership" },
  { value: "Non-profit Corporation", label: "Non-profit" },
  { value: "Co-operative", label: "Co-operative" },
]

const EIN_LETTER_TYPES = ["application/pdf", "image/png", "image/jpeg"]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const EMPTY: VerificationFormState = {
  entity_type: "ein_business",
  legal_business_name: "",
  ein: "",
  dba_name: "",
  contact_first_name: "",
  contact_last_name: "",
  contact_email: "",
  ein_letter_path: null,
  business_type: "",
  rep_title: "",
  rep_job_position: "",
  rep_phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
}

type FieldKey = keyof VerificationFormState

export function maskEin(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 9)
  return d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d
}

function digits(v: string) {
  return v.replace(/\D/g, "")
}

function phoneOk(v: string) {
  const d = digits(v)
  return d.length === 10 || (d.length === 11 && d.startsWith("1"))
}

export function validateBusiness(form: VerificationFormState): Partial<Record<FieldKey, string>> {
  const e: Partial<Record<FieldKey, string>> = {}
  const sole = form.entity_type === "sole_proprietor"
  if (!sole) {
    if (!form.legal_business_name.trim()) e.legal_business_name = "Enter your legal business name exactly as on your EIN letter."
    if (digits(form.ein).length !== 9) e.ein = "Your EIN has 9 digits, like 12-3456789."
    if (!form.business_type) e.business_type = "Choose your business type."
    if (!phoneOk(form.phone)) e.phone = "Enter a 10-digit US phone number."
    if (!form.rep_title.trim()) e.rep_title = "Enter your title, like Owner or Managing Member."
    if (!form.rep_job_position) e.rep_job_position = "Choose the closest job position."
  }
  if (!form.contact_first_name.trim()) e.contact_first_name = "Enter your first name."
  if (!form.contact_last_name.trim()) e.contact_last_name = "Enter your last name."
  if (!EMAIL_RE.test(form.contact_email.trim())) e.contact_email = "Enter a valid email address."
  if (!phoneOk(form.rep_phone)) e.rep_phone = "Enter a 10-digit US mobile number that can receive texts."
  if (!form.address_line1.trim()) e.address_line1 = "Enter a street address."
  if (!form.city.trim()) e.city = "Enter a city."
  if (!/^[A-Za-z]{2}$/.test(form.state.trim())) e.state = "Use the 2-letter state, like TX."
  if (!/^\d{5}(-\d{4})?$/.test(form.zip.trim())) e.zip = "Enter a 5-digit ZIP."
  return e
}

function Field({ id, label, helper, error, children, extra }: { id: string; label: ReactNode; helper?: ReactNode; error?: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {extra}
      </div>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  )
}

function OptionCard({ selected, onClick, icon, title, body, badge }: { selected: boolean; onClick: () => void; icon: ReactNode; title: string; body: string; badge?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        selected ? "border-brand bg-brand/5 ring-1 ring-brand/30" : "border-border bg-card hover:bg-muted/40",
      )}
    >
      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", selected ? "bg-brand text-brand-fg" : "bg-muted text-muted-foreground")}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          {title}
          {badge ? <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">{badge}</span> : null}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{body}</span>
      </span>
    </button>
  )
}

export function BusinessStep() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<VerificationFormState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [loadError, setLoadError] = useState("")
  const [stage, setStage] = useState<string | null>(null)

  const set = (patch: Partial<VerificationFormState>) => setForm((f) => ({ ...f, ...patch }))
  const sole = form.entity_type === "sole_proprietor"

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [res, statusRes] = await Promise.all([
          fetch("/api/business-verification"),
          fetch("/api/org-twilio/status").catch(() => null),
        ])
        if (!res.ok) throw new Error()
        const data = await res.json()
        const status = statusRes && statusRes.ok ? await statusRes.json().catch(() => null) : null
        if (!active) return
        setStage(status?.stage ?? null)
        const businessName: string = data.business_name || ""
        setForm({
          ...EMPTY,
          entity_type: data.entity_type === "sole_proprietor" ? "sole_proprietor" : "ein_business",
          legal_business_name: data.legal_business_name || businessName,
          ein: maskEin(data.ein || ""),
          dba_name: data.dba_name || "",
          contact_first_name: data.contact_first_name || "",
          contact_last_name: data.contact_last_name || "",
          contact_email: data.contact_email || "",
          ein_letter_path: data.ein_letter_path ?? null,
          business_type: data.business_type || "",
          rep_title: data.rep_title || "",
          rep_job_position: data.rep_job_position || "",
          rep_phone: data.rep_phone || "",
          address_line1: data.address_line1 || "",
          address_line2: data.address_line2 || "",
          city: data.city || "",
          state: data.state || "",
          zip: data.zip || "",
          phone: data.phone || "",
        })
      } catch {
        if (active) setLoadError("We couldn't load your business details. Try refreshing the page.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // Live validation once a field has been touched.
  const live = validateBusiness(form)
  const shown = (k: FieldKey) => (touched[k] || errors[k] ? live[k] : undefined)
  const blur = (k: FieldKey) => () => setTouched((t) => ({ ...t, [k]: true }))

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!EIN_LETTER_TYPES.includes(file.type)) {
      toast.error("Upload a PDF, PNG or JPG.")
      return
    }
    setUploading(true)
    try {
      const signRes = await fetch("/api/business-verification/ein-letter/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: [{ name: file.name, type: file.type, size: file.size }] }),
      })
      const signBody = await signRes.json().catch(() => ({}))
      if (!signRes.ok || !signBody?.signed?.length) throw new Error(signBody?.errors?.[0] || "Upload failed")
      const entry = signBody.signed[0]
      const put = await fetch(entry.signedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file })
      if (!put.ok) throw new Error("Upload failed")
      set({ ein_letter_path: entry.path })
    } catch (e: any) {
      toast.error(e?.message || "Upload failed. Try again.")
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    const found = validateBusiness(form)
    setErrors(found)
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0]
      document.getElementById(`biz-${first}`)?.focus()
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/business-verification", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ein: sole ? "" : form.ein }),
      })
      if (!res.ok) throw new Error()
      // A registration waiting on a fix goes straight back to review.
      if (stage === "action_required") {
        await fetch("/api/org-twilio/resubmit", { method: "POST" }).catch(() => null)
      }
      await queryClient.invalidateQueries({ queryKey: ["onboarding"] })
      toast.success("Business details saved")
      router.push("/getting-started")
    } catch {
      toast.error("We couldn't save your details. Check your connection and try again.")
      setSaving(false)
    }
  }

  const input = (k: FieldKey, props: React.ComponentProps<typeof Input> = {}) => (
    <Input
      id={`biz-${k}`}
      value={(form[k] as string) ?? ""}
      onChange={(e) => set({ [k]: e.target.value } as Partial<VerificationFormState>)}
      onBlur={blur(k)}
      aria-invalid={Boolean(shown(k))}
      {...props}
    />
  )

  const submittedForTexting = stage !== null && stage !== "not_started"

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      <div>
        <button type="button" onClick={() => router.push("/getting-started")} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to setup
        </button>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">Your business</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The phone carriers verify who&apos;s texting. You enter this once and we use it everywhere.
        </p>
      </div>

      {loadError ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {loadError}
        </div>
      ) : null}

      {submittedForTexting ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Saving will update your carrier registration.
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            <h2 className="text-sm font-semibold text-foreground">Do you have an EIN (business tax ID)?</h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <OptionCard
                selected={!sole}
                onClick={() => set({ entity_type: "ein_business" as EntityType })}
                icon={<Building2 className="h-4 w-4" />}
                title="Yes — LLC, corporation or partnership"
                badge="Recommended"
                body="Higher texting limits and the fastest approval."
              />
              <OptionCard
                selected={sole}
                onClick={() => set({ entity_type: "sole_proprietor" as EntityType })}
                icon={<User className="h-4 w-4" />}
                title="No — I'm a sole proprietor"
                body="Register under your own name. No EIN needed."
              />
            </div>
          </div>

          {!sole ? (
            <Card className="space-y-4 p-4 sm:p-5">
              <Field
                id="biz-legal_business_name"
                label="Legal business name"
                error={shown("legal_business_name")}
                helper="Exactly as on your IRS EIN letter (CP 575), including LLC or Inc."
                extra={
                  <Popover>
                    <PopoverTrigger className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                      <HelpCircle className="h-3.5 w-3.5" /> Where do I find this?
                    </PopoverTrigger>
                    <PopoverContent className="w-72 text-sm">
                      It&apos;s on the letter the IRS mailed when you got your EIN (form CP 575 or 147C), on the line under
                      &ldquo;Dear Taxpayer&rdquo;. Copy it exactly, including LLC, Inc. and any commas.
                    </PopoverContent>
                  </Popover>
                }
              >
                {input("legal_business_name", { placeholder: "Every State House Buyers LLC" })}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="biz-ein" label="EIN" error={shown("ein")}>
                  <Input
                    id="biz-ein"
                    inputMode="numeric"
                    placeholder="00-0000000"
                    value={form.ein}
                    onChange={(e) => set({ ein: maskEin(e.target.value) })}
                    onBlur={blur("ein")}
                    aria-invalid={Boolean(shown("ein"))}
                  />
                </Field>
                <Field id="biz-business_type" label="Business type" error={shown("business_type")}>
                  <Select value={form.business_type} onValueChange={(v) => (set({ business_type: v }), setTouched((t) => ({ ...t, business_type: true })))}>
                    <SelectTrigger id="biz-business_type">
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
                </Field>
              </div>
              <Field id="biz-dba_name" label={<>Brand name buyers know <span className="font-normal text-muted-foreground">(optional, your DBA)</span></>}>
                {input("dba_name", { placeholder: "Every State House Buyers" })}
              </Field>
            </Card>
          ) : (
            <Card className="space-y-2 p-4 sm:p-5">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>Limited to 1 number and about 1,000 texts a day to T-Mobile. You can upgrade later.</span>
              </div>
            </Card>
          )}

          <Card className="space-y-4 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">{sole ? "About you" : "You (the person responsible)"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="biz-contact_first_name" label={sole ? "Your legal first name" : "First name"} error={shown("contact_first_name")}>
                {input("contact_first_name", { autoComplete: "given-name" })}
              </Field>
              <Field id="biz-contact_last_name" label={sole ? "Your legal last name" : "Last name"} error={shown("contact_last_name")}>
                {input("contact_last_name", { autoComplete: "family-name" })}
              </Field>
            </div>
            {!sole ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="biz-rep_title" label="Your title" error={shown("rep_title")}>
                  {input("rep_title", { placeholder: "Owner" })}
                </Field>
                <Field id="biz-rep_job_position" label="Job position" error={shown("rep_job_position")}>
                  <Select value={form.rep_job_position} onValueChange={(v) => (set({ rep_job_position: v }), setTouched((t) => ({ ...t, rep_job_position: true })))}>
                    <SelectTrigger id="biz-rep_job_position">
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
                </Field>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="biz-contact_email" label="Email" error={shown("contact_email")}>
                {input("contact_email", { type: "email", autoComplete: "email" })}
              </Field>
              <Field
                id="biz-rep_phone"
                label="Mobile"
                error={shown("rep_phone")}
                helper={sole ? "You'll confirm it by replying YES to a text." : "For carrier verification texts."}
              >
                {input("rep_phone", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "(512) 555-0123" })}
              </Field>
            </div>
            {sole ? (
              <Field id="biz-dba_name" label={<>Brand name to show buyers <span className="font-normal text-muted-foreground">(optional)</span></>}>
                {input("dba_name", { placeholder: "Josh Buys Houses" })}
              </Field>
            ) : null}
          </Card>

          <Card className="space-y-4 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">{sole ? "Home or business address" : "Business address"}</h2>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Field id="biz-address_line1" label="Street" error={shown("address_line1")}>
                {input("address_line1", { autoComplete: "address-line1" })}
              </Field>
              <Field id="biz-address_line2" label={<>Suite <span className="font-normal text-muted-foreground">(optional)</span></>}>
                {input("address_line2", { autoComplete: "address-line2" })}
              </Field>
            </div>
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
              <Field id="biz-city" label="City" error={shown("city")}>
                {input("city", { autoComplete: "address-level2" })}
              </Field>
              <Field id="biz-state" label="State" error={shown("state")}>
                <Input
                  id="biz-state"
                  maxLength={2}
                  value={form.state}
                  onChange={(e) => set({ state: e.target.value.toUpperCase() })}
                  onBlur={blur("state")}
                  autoComplete="address-level1"
                  aria-invalid={Boolean(shown("state"))}
                />
              </Field>
              <Field id="biz-zip" label="ZIP" error={shown("zip")}>
                {input("zip", { inputMode: "numeric", autoComplete: "postal-code" })}
              </Field>
            </div>
            {!sole ? (
              <Field id="biz-phone" label="Business phone" error={shown("phone")}>
                {input("phone", { type: "tel", inputMode: "tel", placeholder: "(512) 555-0100" })}
              </Field>
            ) : null}
          </Card>

          {!sole ? (
            <Card className="space-y-2 p-4 sm:p-5">
              <div className="text-sm font-semibold text-foreground">
                EIN letter <span className="font-normal text-muted-foreground">(optional)</span>
              </div>
              <p className="text-xs text-muted-foreground">Upload it if you have it handy. It helps if the carriers ask questions.</p>
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              {form.ein_letter_path ? (
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-600" /> Uploaded
                  <button type="button" onClick={() => set({ ein_letter_path: null })} className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload EIN letter
                </Button>
              )}
            </Card>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Next: your website. It takes about a minute.</p>
            <Button variant="brand" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save business details
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
