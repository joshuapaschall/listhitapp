"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Upload, X, ArrowLeft, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import type { EntityType, VerificationFormState } from "@/lib/business-verification/types"

const EIN_RE = /^\d{2}-?\d{7}$/
const EIN_LETTER_TYPES = ["application/pdf", "image/png", "image/jpeg"]

const EMPTY: VerificationFormState = {
  entity_type: null,
  legal_business_name: "",
  ein: "",
  dba_name: "",
  contact_first_name: "",
  contact_last_name: "",
  contact_email: "",
  ein_letter_path: null,
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>
  )
}

function Field({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  )
}

export function VerifyBusinessForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<VerificationFormState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<"draft" | "continue" | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [missing, setMissing] = useState<string[]>([])

  const set = (patch: Partial<VerificationFormState>) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/business-verification")
        if (!res.ok) throw new Error("Failed to load")
        const data = await res.json()
        if (!active) return
        const businessName: string = data.business_name || ""
        set({
          entity_type: data.entity_type ?? null,
          legal_business_name: data.legal_business_name || businessName,
          ein: data.ein || "",
          dba_name: data.dba_name || businessName,
          contact_first_name: data.contact_first_name || "",
          contact_last_name: data.contact_last_name || "",
          contact_email: data.contact_email || "",
          ein_letter_path: data.ein_letter_path ?? null,
          address_line1: data.address_line1 || "",
          address_line2: data.address_line2 || "",
          city: data.city || "",
          state: data.state || "",
          zip: data.zip || "",
          phone: data.phone || "",
        })
      } catch {
        if (active) setError("Couldn't load your business details. Try refreshing.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const isEin = form.entity_type === "ein_business"
  const isSole = form.entity_type === "sole_proprietor"
  const einValid = EIN_RE.test(form.ein.trim())

  function computeMissing(): string[] {
    const m: string[] = []
    if (!form.entity_type) m.push("Business type")
    if (!form.legal_business_name.trim()) m.push("Legal business name")
    if (isEin && !einValid) m.push("A valid EIN")
    if (!form.contact_first_name.trim()) m.push("Contact first name")
    if (!form.contact_last_name.trim()) m.push("Contact last name")
    if (!form.contact_email.trim()) m.push("Contact email")
    if (!form.address_line1.trim()) m.push("Street address")
    if (!form.city.trim()) m.push("City")
    if (!form.state.trim()) m.push("State")
    if (!form.zip.trim()) m.push("ZIP")
    if (!form.phone.trim()) m.push("Business phone")
    return m
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError("")
    if (!EIN_LETTER_TYPES.includes(file.type)) {
      setError("Upload a PDF, PNG, or JPG.")
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
      if (!signRes.ok || !signBody?.signed?.length) {
        throw new Error(signBody?.errors?.[0] || signBody?.error || "Upload failed")
      }
      const entry = signBody.signed[0]
      const put = await fetch(entry.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!put.ok) throw new Error("Upload failed")
      set({ ein_letter_path: entry.path })
    } catch (e: any) {
      setError(e?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function save(mode: "draft" | "continue") {
    setSaving(mode)
    setError("")
    setMissing([])
    try {
      const res = await fetch("/api/business-verification", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to save")
      if (mode === "continue") {
        if (data?.status === "ready") {
          router.push("/getting-started")
          return
        }
        setMissing(computeMissing())
      }
    } catch (e: any) {
      setError(e?.message || "Failed to save")
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  const fileName = form.ein_letter_path ? form.ein_letter_path.split("/").pop() : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() => router.push("/getting-started")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to setup
        </button>
        <h1 className="mt-3 text-lg font-semibold text-foreground">Verify your business</h1>
        <p className="text-sm text-muted-foreground">
          Carriers need this to approve business texting. EIN or sole proprietor — nobody gets stuck.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Branch selector */}
      <div className="space-y-2">
        <SectionHeader>How is your business set up?</SectionHeader>
        <RadioGroup
          value={form.entity_type ?? ""}
          onValueChange={(v) => set({ entity_type: v as EntityType })}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {[
            { v: "ein_business", title: "Registered business", desc: "LLC, corp, etc. — verified by EIN." },
            { v: "sole_proprietor", title: "Sole proprietor", desc: "No EIN — verified by text." },
          ].map((opt) => {
            const active = form.entity_type === opt.v
            return (
              <label
                key={opt.v}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5",
                  active ? "border-2 border-brand bg-card" : "border-border bg-card hover:bg-muted/40",
                )}
              >
                <RadioGroupItem value={opt.v} className={cn("mt-0.5", active && "border-brand text-brand")} />
                <span>
                  <span className="block text-sm font-medium text-foreground">{opt.title}</span>
                  <span className="block text-xs text-muted-foreground">{opt.desc}</span>
                </span>
              </label>
            )
          })}
        </RadioGroup>
        {isSole ? (
          <p className="text-xs text-muted-foreground">
            We&apos;ll verify by texting a code to your business phone — no EIN needed.
          </p>
        ) : null}
      </div>

      {form.entity_type ? (
        <>
          {/* Your business */}
          <div className="space-y-3">
            <SectionHeader>Your business</SectionHeader>
            <Field label="Legal business name" helper="Match your CP-575 exactly.">
              <Input
                value={form.legal_business_name}
                onChange={(e) => set({ legal_business_name: e.target.value })}
              />
            </Field>
            {isEin ? (
              <Field label="EIN" helper="The carrier confirms this matches your IRS records.">
                <Input
                  value={form.ein}
                  onChange={(e) => set({ ein: e.target.value })}
                  placeholder="12-3456789"
                  inputMode="numeric"
                />
                {form.ein.trim() ? (
                  einValid ? (
                    <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" /> Format looks right.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Enter 9 digits, like 12-3456789.</p>
                  )
                ) : null}
              </Field>
            ) : null}
            <Field label="DBA / brand name" helper="The name buyers will see.">
              <Input value={form.dba_name} onChange={(e) => set({ dba_name: e.target.value })} />
            </Field>
          </div>

          {/* Where you're located */}
          <div className="space-y-3">
            <SectionHeader>Where you&apos;re located</SectionHeader>
            <Field label="Street address" helper="Pulled from your organization — changes save back there too.">
              <Input value={form.address_line1} onChange={(e) => set({ address_line1: e.target.value })} />
            </Field>
            <Field label="Suite / unit (optional)">
              <Input value={form.address_line2} onChange={(e) => set({ address_line2: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2">
                <Field label="City">
                  <Input value={form.city} onChange={(e) => set({ city: e.target.value })} />
                </Field>
              </div>
              <Field label="State">
                <Input value={form.state} onChange={(e) => set({ state: e.target.value })} />
              </Field>
              <Field label="ZIP">
                <Input value={form.zip} onChange={(e) => set({ zip: e.target.value })} />
              </Field>
            </div>
            <Field label="Business phone">
              <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
          </div>

          {/* Authorized contact */}
          <div className="space-y-3">
            <SectionHeader>Authorized contact</SectionHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="First name">
                <Input
                  value={form.contact_first_name}
                  onChange={(e) => set({ contact_first_name: e.target.value })}
                />
              </Field>
              <Field label="Last name">
                <Input
                  value={form.contact_last_name}
                  onChange={(e) => set({ contact_last_name: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Email">
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) => set({ contact_email: e.target.value })}
              />
            </Field>
          </div>

          {/* Proof — optional (EIN path only) */}
          {isEin ? (
            <div className="space-y-3">
              <SectionHeader>Proof — optional</SectionHeader>
              <input
                ref={fileInputRef}
                type="file"
                accept={EIN_LETTER_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
              {fileName ? (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                  <span className="truncate text-sm text-foreground">{fileName}</span>
                  <button
                    type="button"
                    onClick={() => set({ ein_letter_path: null })}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      <span>Upload your CP-575 (PDF, PNG, or JPG)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : null}

          {missing.length ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Still needed before this is complete: {missing.join(", ")}.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => router.push("/getting-started")}>
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => save("draft")} disabled={saving !== null}>
                {saving === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save draft"}
              </Button>
              <Button type="button" variant="brand" onClick={() => save("continue")} disabled={saving !== null}>
                {saving === "continue" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save and continue"}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
