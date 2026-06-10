"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

type Site = { id: string; name: string; slug: string; status: string }

const OPT_IN_BLOCKS = [
  {
    label: "Opt-in notice (near your form)",
    text: "By submitting your information, you agree to receive recurring text messages from [Your Business] about properties, offers, and updates. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of any purchase. View our Privacy Policy and Terms of Service.",
  },
  {
    label: "Consent checkbox label (on your form)",
    text: "I agree to receive text messages from [Your Business] at the number provided. Msg & data rates may apply. Reply STOP to opt out.",
  },
  {
    label: "Privacy policy clause (on your privacy page)",
    text: "No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Text messaging opt-in data and consent are never shared with anyone.",
  },
]

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5"
          onClick={() => {
            navigator.clipboard?.writeText(text).catch(() => {})
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-foreground">{text}</p>
    </div>
  )
}

function ExternalSiteCard({
  brandAccent,
  onError,
  onSaved,
}: {
  brandAccent: boolean
  onError: (msg: string) => void
  onSaved: () => void
}) {
  const [url, setUrl] = useState("")
  const [hasOptIn, setHasOptIn] = useState(false)
  const [hasPrivacy, setHasPrivacy] = useState(false)
  const [showLanguage, setShowLanguage] = useState(false)
  const [saving, setSaving] = useState(false)

  const canSave = url.trim().length > 0 && hasOptIn && hasPrivacy

  async function save() {
    setSaving(true)
    onError("")
    try {
      const res = await fetch("/api/onboarding/website", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "external", url: url.trim(), attested: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to save")
      onSaved()
    } catch (e: any) {
      onError(e?.message || "Failed to save")
      setSaving(false)
    }
  }

  return (
    <Card
      className={cn("space-y-3 p-5", brandAccent ? "border-2 border-brand" : "border-border")}
    >
      <div>
        <h2 className="text-sm font-semibold text-foreground">I already have a website</h2>
        <p className="text-xs text-muted-foreground">Use a site you already have.</p>
      </div>

      <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />

      <label className="flex items-start gap-2.5 text-sm text-foreground">
        <Checkbox
          checked={hasOptIn}
          onCheckedChange={(v) => setHasOptIn(v === true)}
          className="mt-0.5"
        />
        <span>My site shows an SMS opt-in notice where people submit their info</span>
      </label>
      <label className="flex items-start gap-2.5 text-sm text-foreground">
        <Checkbox
          checked={hasPrivacy}
          onCheckedChange={(v) => setHasPrivacy(v === true)}
          className="mt-0.5"
        />
        <span>My site has a privacy policy page</span>
      </label>

      <button
        type="button"
        onClick={() => setShowLanguage((s) => !s)}
        className="text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {showLanguage ? "Hide the opt-in language" : "Show the opt-in language to add"}
      </button>
      {showLanguage ? (
        <div className="space-y-2">
          {OPT_IN_BLOCKS.map((b) => (
            <CopyBlock key={b.label} label={b.label} text={b.text} />
          ))}
        </div>
      ) : null}

      <div className="pt-1">
        <Button type="button" variant="outline" onClick={save} disabled={!canSave || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save and continue"}
        </Button>
      </div>
    </Card>
  )
}

export function WebsiteStep() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [usingListhit, setUsingListhit] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [sitesRes] = await Promise.all([
          fetch("/api/sites"),
          fetch("/api/organization").catch(() => null),
        ])
        const sitesBody = sitesRes.ok ? await sitesRes.json() : { sites: [] }
        if (!active) return
        setSites(Array.isArray(sitesBody?.sites) ? sitesBody.sites : [])
      } catch {
        if (active) setError("Couldn't load your sites. Try refreshing.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const published = sites.find((s) => s.status === "published")
  const hasDrafts = sites.length > 0 && !published

  async function useListhit() {
    setUsingListhit(true)
    setError("")
    try {
      const res = await fetch("/api/onboarding/website", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "listhit" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to save")
      router.push("/getting-started")
    } catch (e: any) {
      setError(e?.message || "Failed to save")
      setUsingListhit(false)
    }
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
        <h1 className="mt-3 text-lg font-semibold text-foreground">Get your website</h1>
        <p className="text-sm text-muted-foreground">
          Carriers require a public site with an SMS opt-in notice and a privacy policy before they
          approve texting.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : published ? (
        // A) A published ListHit site exists
        <Card className="space-y-3 border-2 border-brand p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{published.name}</h2>
            <a
              href={`https://${published.slug}.listhit.io`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            >
              {published.slug}.listhit.io
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <p className="mt-1 text-xs text-muted-foreground">This site is set up for texting approval.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="brand" onClick={useListhit} disabled={usingListhit}>
              {usingListhit ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Use this site for texting <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
            <button
              type="button"
              onClick={() => router.push(`/websites/${published.id}`)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Manage site
            </button>
          </div>
        </Card>
      ) : hasDrafts ? (
        // B) Only draft site(s) exist
        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Finish your site</h2>
              <p className="text-xs text-muted-foreground">Publish it to use it for texting.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => router.push(`/websites/${sites[0].id}`)}>
              Manage &amp; publish
            </Button>
          </Card>
          <ExternalSiteCard
            brandAccent={false}
            onError={setError}
            onSaved={() => router.push("/getting-started")}
          />
        </div>
      ) : (
        // C) No site — two-path choice
        <div className="grid grid-cols-1 gap-4">
          <Card className="space-y-3 border-2 border-brand p-5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Build one with ListHit</h2>
              <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-fg">
                Recommended
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Free, and live in minutes. Opt-in notice, privacy policy, and terms are built in — and we
              pull in your business info automatically.
            </p>
            <Button type="button" variant="brand" onClick={() => router.push("/websites/new?from=onboarding")}>
              Build my site <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Card>
          <ExternalSiteCard
            brandAccent={false}
            onError={setError}
            onSaved={() => router.push("/getting-started")}
          />
        </div>
      )}
    </div>
  )
}
