"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check, Loader2, ArrowLeft, AlertCircle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { A2pAssembledState } from "@/lib/a2p-registration/types"

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>
  )
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || "—"}</span>
    </div>
  )
}

export function A2pRegistrationForm() {
  const router = useRouter()
  const [state, setState] = useState<A2pAssembledState | null>(null)
  const [sample1, setSample1] = useState("")
  const [sample2, setSample2] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/a2p-registration")
        if (!res.ok) throw new Error("Failed to load")
        const data: A2pAssembledState = await res.json()
        if (!active) return
        setState(data)
        setSample1(data.samples.sample1)
        setSample2(data.samples.sample2)
      } catch {
        if (active) setError("Couldn't load your registration. Try refreshing.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const blocked = !!state && (!state.ready.verifyReady || !state.ready.websiteSet)
  const canSubmit = sample1.trim().length > 0 && sample2.trim().length > 0 && !blocked

  async function submit() {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/a2p-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sample_message_1: sample1.trim(), sample_message_2: sample2.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to save")
      setState(data)
      if (data?.status === "ready") setDone(true)
    } catch (e: any) {
      setError(e?.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (!state) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Couldn't load your registration."}</AlertDescription>
        </Alert>
      </div>
    )
  }

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
        <h1 className="mt-3 text-lg font-semibold text-foreground">Register for texting (A2P 10DLC)</h1>
        <p className="text-sm text-muted-foreground">
          We assemble your carrier application from what you&apos;ve already entered. Add two sample texts and
          you&apos;re set.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {blocked ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {!state.ready.verifyReady ? (
              <>
                Finish <Link href="/getting-started/verify-business" className="font-medium underline">Verify your business</Link> first.{" "}
              </>
            ) : null}
            {!state.ready.websiteSet ? (
              <>
                Set your website in <Link href="/getting-started/website" className="font-medium underline">Get your website</Link> first.
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Card 1 — brand identity from Verify business */}
      <Card className="space-y-2 p-5">
        <div className="flex items-center justify-between">
          <SectionHeader>Your business · from Verify business</SectionHeader>
          <Link href="/getting-started/verify-business" className="text-xs font-medium text-brand hover:underline">
            Edit
          </Link>
        </div>
        <ReadRow label="Legal name" value={state.brand.legalDisplay} />
        <ReadRow label="EIN" value={state.brand.einMasked} />
        <ReadRow label="Address" value={state.brand.address} />
        <ReadRow label="Contact" value={state.brand.contactName} />
        <ReadRow label="Email" value={state.brand.contactEmail} />
        <ReadRow label="Phone" value={state.brand.phone} />
      </Card>

      {/* Card 2 — texting program */}
      <Card className="space-y-3 p-5">
        <SectionHeader>Your texting program</SectionHeader>
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
          <span className="text-sm font-medium text-foreground">{state.program.useCaseLabel}</span>
          <span className="text-xs text-muted-foreground">Set for you</span>
        </div>
        <div>
          <Label>What you&apos;ll send</Label>
          <div className="mt-1.5 rounded-lg border border-border bg-muted/30 p-3 text-sm leading-relaxed text-muted-foreground">
            {state.program.campaignDescription}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {state.ready.websiteSet ? (
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-muted-foreground">
            People opt in at{" "}
            {state.program.optInUrl ? (
              <a
                href={state.program.optInUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
              >
                {state.program.optInUrl.replace(/^https?:\/\//, "")}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              "your site"
            )}
          </span>
        </div>
      </Card>

      {/* Card 3 — sample messages */}
      <Card className="space-y-3 p-5">
        <SectionHeader>Add two sample texts</SectionHeader>
        <p className="text-xs text-muted-foreground">
          Name your business in each and keep &quot;Reply STOP&quot; — carriers check for both.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="sample1">Sample 1</Label>
          <Textarea id="sample1" rows={3} value={sample1} onChange={(e) => setSample1(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sample2">Sample 2</Label>
          <Textarea id="sample2" rows={3} value={sample2} onChange={(e) => setSample2(e.target.value)} />
        </div>
      </Card>

      {done ? (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertDescription>
            Your application is assembled and ready. It&apos;ll be filed with the carrier once your texting
            connection is set up — we&apos;ll take it from there.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/getting-started")}>
          Back
        </Button>
        <Button type="button" variant="brand" onClick={submit} disabled={!canSubmit || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for carrier review"}
        </Button>
      </div>
    </div>
  )
}
