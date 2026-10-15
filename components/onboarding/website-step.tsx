"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ExternalLink, Globe, Loader2, Sparkles, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CustomDomainCard } from "@/components/websites/custom-domain-card"
import { cn } from "@/lib/utils"

type Site = { id: string; name: string; slug: string; status: string }
type UrlField = "url" | "privacyUrl" | "termsUrl"
type Check = { state: "idle" | "checking" | "ok" | "bad"; message?: string }

const CARRIER_CHECKLIST = [
  "A working website that loads",
  "A privacy policy that says phone numbers are never shared or sold",
  "Terms of service",
  "A sign-up form with an SMS consent box that starts unchecked",
]

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
      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", selected ? "bg-brand text-brand-fg" : "bg-muted text-muted-foreground")}>{icon}</span>
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

function CheckBadge({ check }: { check: Check }) {
  if (check.state === "checking") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  if (check.state === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Page opens" />
  if (check.state === "bad") return <XCircle className="h-4 w-4 text-destructive" aria-label="Page didn't open" />
  return null
}

function LiveSite({ site, url }: { site: Site; url: string }) {
  const router = useRouter()
  const [showDomain, setShowDomain] = useState(false)
  return (
    <div className="space-y-4">
      <Card className="space-y-3 border-emerald-200 p-5 dark:border-emerald-900">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Your buyer website is live</h2>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all text-sm font-medium text-brand hover:underline">
              {url.replace(/^https:\/\//, "")} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
            <p className="mt-1 text-xs text-muted-foreground">Includes the privacy policy, terms and buyer sign-up form carriers require.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="brand" onClick={() => router.push("/getting-started")}>
            Back to setup <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" onClick={() => router.push(`/websites/${site.id}`)}>
            Customize your site
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        {showDomain ? (
          <CustomDomainCard siteId={site.id} slug={site.slug} embedded />
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Use your own domain</div>
              <p className="text-xs text-muted-foreground">Optional. Put your site on a domain you own, like yourbrand.com.</p>
            </div>
            <Button variant="ghost" onClick={() => setShowDomain(true)}>
              <Globe className="h-4 w-4" /> Connect your domain
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

export function WebsiteStep() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [sites, setSites] = useState<Site[]>([])
  const [liveUrl, setLiveUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [choice, setChoice] = useState<"create" | "existing">("create")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [fields, setFields] = useState<Record<UrlField, string>>({ url: "", privacyUrl: "", termsUrl: "" })
  const [checks, setChecks] = useState<Record<UrlField, Check>>({ url: { state: "idle" }, privacyUrl: { state: "idle" }, termsUrl: { state: "idle" } })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/sites")
        const body = res.ok ? await res.json() : { sites: [] }
        if (!active) return
        const list: Site[] = Array.isArray(body?.sites) ? body.sites : []
        setSites(list)
        const published = list.find((s) => s.status === "published")
        if (published) {
          const r = await fetch("/api/onboarding/website", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: "listhit" }),
          }).catch(() => null)
          const b = r && r.ok ? await r.json().catch(() => null) : null
          if (active) setLiveUrl(b?.website_url || `https://${published.slug}.listhit.io`)
        }
      } catch {
        if (active) setError("We couldn't load your website. Try refreshing the page.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const published = sites.find((s) => s.status === "published") ?? null

  async function createSite() {
    setCreating(true)
    setError("")
    try {
      const res = await fetch("/api/onboarding/website/create", { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) throw new Error(body?.error || "We couldn't create your website. Try again in a minute.")
      setSites([{ ...body.site, status: "published" }])
      setLiveUrl(body.website_url)
      await queryClient.invalidateQueries({ queryKey: ["onboarding"] })
      toast.success("Your website is live")
    } catch (e: any) {
      setError(e?.message || "We couldn't create your website. Try again in a minute.")
    } finally {
      setCreating(false)
    }
  }

  async function checkField(k: UrlField) {
    const value = fields[k].trim()
    if (!value) return setChecks((c) => ({ ...c, [k]: { state: "idle" } }))
    setChecks((c) => ({ ...c, [k]: { state: "checking" } }))
    try {
      const res = await fetch("/api/onboarding/website/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      })
      const body = await res.json().catch(() => ({}))
      setChecks((c) => ({ ...c, [k]: body?.ok ? { state: "ok" } : { state: "bad", message: body?.error || "We couldn't open this page" } }))
    } catch {
      setChecks((c) => ({ ...c, [k]: { state: "bad", message: "We couldn't open this page" } }))
    }
  }

  async function saveExisting() {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/onboarding/website", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "external", ...fields }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.ok) {
        const fe = (body?.fieldErrors ?? {}) as Partial<Record<UrlField, string>>
        setChecks((c) => {
          const next = { ...c }
          for (const k of Object.keys(fe) as UrlField[]) next[k] = { state: "bad", message: fe[k] }
          return next
        })
        throw new Error(body?.error || "We couldn't save your website.")
      }
      await queryClient.invalidateQueries({ queryKey: ["onboarding"] })
      toast.success("Website saved")
      router.push("/getting-started")
    } catch (e: any) {
      setError(e?.message || "We couldn't save your website.")
      setSaving(false)
    }
  }

  const urlInput = (k: UrlField, label: string, placeholder: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`web-${k}`}>{label}</Label>
      <div className="relative">
        <Input
          id={`web-${k}`}
          inputMode="url"
          placeholder={placeholder}
          value={fields[k]}
          onChange={(e) => {
            setFields((f) => ({ ...f, [k]: e.target.value }))
            setChecks((c) => ({ ...c, [k]: { state: "idle" } }))
          }}
          onBlur={() => checkField(k)}
          aria-invalid={checks[k].state === "bad"}
          className="pr-9"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          <CheckBadge check={checks[k]} />
        </span>
      </div>
      {checks[k].state === "bad" ? <p className="text-xs font-medium text-destructive">{checks[k].message}</p> : null}
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      <div>
        <button type="button" onClick={() => router.push("/getting-started")} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to setup
        </button>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">Your website</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Carriers check your website before they approve texting. Buyers sign up there too.
        </p>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : published && liveUrl ? (
        <LiveSite site={published} url={liveUrl} />
      ) : (
        <>
          <div className="grid gap-2.5">
            <OptionCard
              selected={choice === "create"}
              onClick={() => setChoice("create")}
              icon={<Sparkles className="h-4 w-4" />}
              title="Create my buyer website"
              badge="Recommended · 1 minute"
              body="We build it from your business details and publish it for you."
            />
            <OptionCard
              selected={choice === "existing"}
              onClick={() => setChoice("existing")}
              icon={<Globe className="h-4 w-4" />}
              title="I already have a website"
              body="Use your own site. It needs a privacy policy and terms page."
            />
          </div>

          {choice === "create" ? (
            <Card className="space-y-3 p-5">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {["Your business name, phone and email, already filled in", "Privacy policy, terms and buyer sign-up form carriers require", "A free web address you can swap for your own domain later"].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {t}
                  </li>
                ))}
              </ul>
              <Button variant="brand" onClick={createSite} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {creating ? "Building your website…" : sites.length ? "Publish my website" : "Create my website"}
              </Button>
            </Card>
          ) : (
            <Card className="space-y-4 p-5">
              {urlInput("url", "Website address", "https://yourbrand.com")}
              {urlInput("privacyUrl", "Privacy policy page", "https://yourbrand.com/privacy")}
              {urlInput("termsUrl", "Terms page", "https://yourbrand.com/terms")}
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="mb-1.5 text-xs font-semibold text-foreground">What carriers look for</div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {CARRIER_CHECKLIST.map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              <Button variant="brand" onClick={saveExisting} disabled={saving || !fields.url.trim() || !fields.privacyUrl.trim() || !fields.termsUrl.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Checking your pages…" : "Save my website"}
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
