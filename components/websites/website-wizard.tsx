"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Eye, Loader2, Lock, Upload, X } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { SitePreview } from "@/components/websites/site-preview"
import { CustomDomainCard } from "@/components/websites/custom-domain-card"
import { CURATED_HERO_IMAGES, extractContent, type WizardContent } from "@/lib/site-builder/compose"
import { buildConsentTexts } from "@/lib/site-builder/compliance"
import { ALL_SITE_TEMPLATES } from "@/lib/site-builder/templates"
import { PERSONAS, getPersona } from "@/lib/site-builder/templates"
import { TYPE_STYLES, resolveTypeFonts, DEFAULT_TYPE_STYLE_ID } from "@/lib/site-builder/typography"
import { PALETTES } from "@/lib/site-builder/palettes"
import { DEFAULT_THEME, DEFAULT_BUSINESS, DEFAULT_MARKETS, type SitePersona, type SiteTemplateId, type SiteTheme, type SiteBusiness, type SiteMarkets } from "@/lib/site-builder/types"
import { useLocationSuggestions } from "@/components/buyers/use-location-suggestions"
import { formatMarketLabel } from "@/lib/site-builder/location-pages"
import { EXTRA_PAGES } from "@/lib/site-builder/extra-pages"

type WizardProps = { mode: "new" } | { mode: "edit"; siteId: string }

// Default toggleable nav pages, sorted by the canonical sort order and seeded
// immediately so the wizard preview shows the full nav/footer from step 1 —
// before the site row (and its site_pages) exist. Reconciled with the DB once
// the site is created / hydrated.
const DEFAULT_NAV_PAGES = [...EXTRA_PAGES]
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((p) => ({ path: p.path, nav_label: p.navLabel, enabled: p.enabledByDefault }))

// path → canonical sort order, used to keep DB-returned pages in published order.
const PAGE_SORT_ORDER = new Map(EXTRA_PAGES.map((p) => [p.path, p.sortOrder]))

const STEPS = ["Who it's for", "Template", "Your area", "Brand", "Message", "Texting", "Launch"]

const PERSONA_BLURBS: Record<SitePersona, string> = {
  cash: "Build a cash-buyer list for your wholesale deals.",
  investor: "Send vetted deals to your investor network.",
  rto: "Capture rent-to-own ready buyers.",
  owner: "Build a list of owner-finance buyers.",
  creative: "Subject-to, lease-option and creative-terms buyers.",
  land: "Build a land and lot buyer list.",
  commercial: "Grow a commercial buyer network.",
  agent: "Build your own private buyer list.",
}

const TEMPLATE_BLURBS: Record<string, string> = {
  marquee: "Bold full-bleed photo hero with a floating form.",
  haven: "Calm centered hero with an inline form row.",
  vantage: "Split hero: form left, photo + stat right.",
  forge: "High-contrast color band hero, inline form.",
}

function seedContent(name: string, persona: SitePersona): WizardContent {
  const p = getPersona(persona)
  const brand = name || "Your Company"
  return {
    brandName: brand,
    phone: "(555) 555-5555",
    headline: p.headline,
    subhead: p.subhead,
    ctaLabel: p.ctaLabel,
    heroImageUrl: CURATED_HERO_IMAGES[0].url,
    footerText: `© ${brand}. All rights reserved.`,
    announcementText: p.announcement,
  }
}

interface TrackingConfig {
  ga4_id?: string
  google_ads_id?: string
  google_ads_label?: string
  meta_pixel_id?: string
}

interface Draft {
  name: string
  persona: SitePersona
  templateId: SiteTemplateId
  theme: SiteTheme
  content: WizardContent
  business: SiteBusiness
  markets: SiteMarkets
  tracking: TrackingConfig
}

const ASSET_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml"

// Sign + upload a brand asset (logo / hero photo) to the public site-assets
// bucket via the browser client, returning its public URL. Mirrors the
// property-image upload flow — never touches the admin client.
async function uploadSiteAsset(file: File, siteId: string): Promise<string> {
  const signRes = await fetch(`/api/sites/${siteId}/assets/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: [{ name: file.name, type: file.type, size: file.size }] }),
  })
  const signData = await signRes.json().catch(() => ({}))
  const entry = signData?.signed?.[0]
  if (!signRes.ok || !entry) {
    throw new Error(signData?.errors?.[0] || signData?.error || "Could not start upload")
  }
  const supabase = supabaseBrowser()
  const { error: upErr } = await supabase.storage
    .from("site-assets")
    .uploadToSignedUrl(entry.path, entry.token, file, { contentType: file.type })
  if (upErr) throw new Error(upErr.message)
  return supabase.storage.from("site-assets").getPublicUrl(entry.path).data.publicUrl
}

export default function WebsiteWizard(props: WizardProps) {
  const router = useRouter()
  const isEdit = props.mode === "edit"
  const fromOnboarding = useSearchParams().get("from") === "onboarding"
  const seededRef = useRef(false)

  const [step, setStep] = useState(0)
  const [siteId, setSiteId] = useState<string | null>(isEdit ? props.siteId : null)
  const [slug, setSlug] = useState<string>("")
  const [status, setStatus] = useState<string>("draft")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState("")
  const [published, setPublished] = useState(false)
  const [copiedLive, setCopiedLive] = useState(false)
  const [mobilePreview, setMobilePreview] = useState(false)
  const [pages, setPages] = useState<{ path: string; nav_label: string; enabled: boolean }[]>(
    DEFAULT_NAV_PAGES,
  )

  const [draft, setDraft] = useState<Draft>(() => ({
    name: "",
    persona: "cash",
    templateId: "marquee",
    theme: { ...DEFAULT_THEME },
    content: seedContent("", "cash"),
    business: { ...DEFAULT_BUSINESS },
    markets: { ...DEFAULT_MARKETS },
    tracking: {},
  }))

  // New mode: best-effort prefill business fields + site name from the org and
  // the verify-business record, so the user never retypes what they entered.
  // Runs once; never clobbers later user edits (ref guard + `d.name ||`).
  useEffect(() => {
    if (isEdit || seededRef.current) return
    seededRef.current = true
    ;(async () => {
      try {
        const res = await fetch("/api/onboarding/site-defaults")
        if (!res.ok) return
        const data = await res.json()
        setDraft((d) => ({
          ...d,
          name: d.name || data.name || "",
          business: { ...d.business, ...(data.business || {}) },
        }))
      } catch {
        /* non-blocking: prefill is best-effort */
      }
    })()
  }, [isEdit])

  // Keep only sub-pages that can appear in the nav (labeled, non-home).
  const toToggleable = (rows: any[]) =>
    (rows || [])
      .filter((p) => p?.nav_label && p?.path !== "/")
      .map((p) => ({ path: p.path, nav_label: p.nav_label, enabled: p.enabled !== false }))
      .sort((a, b) => (PAGE_SORT_ORDER.get(a.path) ?? 999) - (PAGE_SORT_ORDER.get(b.path) ?? 999))

  // Edit mode: hydrate from the API and jump to the Brand step.
  useEffect(() => {
    if (!isEdit) return
    let active = true
    ;(async () => {
      try {
        const res = await fetch(`/api/sites/${props.siteId}`)
        if (!res.ok) throw new Error("Failed to load site")
        const { site, pages } = await res.json()
        if (!active) return
        setPages(toToggleable(pages))
        const theme: SiteTheme = { ...DEFAULT_THEME, ...(site.theme_json || {}) }
        const home = (pages || []).find((p: any) => p.path === "/")
        const content = home ? extractContent(home.puck_data) : seedContent(site.name, site.persona)
        setDraft({
          name: site.name || "",
          persona: (site.persona as SitePersona) || "cash",
          templateId: (site.template_id as SiteTemplateId) || "marquee",
          theme,
          content,
          // Opt-in is mandatory and not user-editable — force it on regardless of
          // any older stored value.
          business: { ...DEFAULT_BUSINESS, ...(site.business_json || {}), optin: { enabled: true, requireConsent: true } },
          markets: { ...DEFAULT_MARKETS, ...(site.markets_json || {}) },
          tracking: (site.tracking_json || {}) as TrackingConfig,
        })
        setSlug(site.slug || "")
        setStatus(site.status || "draft")
        setStep(2)
      } catch (e: any) {
        if (active) setError(e?.message || "Failed to load site")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [isEdit, props])

  const setTheme = (patch: Partial<SiteTheme>) =>
    setDraft((d) => ({ ...d, theme: { ...d.theme, ...patch } }))
  const setContent = (patch: Partial<WizardContent>) =>
    setDraft((d) => ({ ...d, content: { ...d.content, ...patch } }))
  const setBusiness = (patch: Partial<SiteBusiness>) =>
    setDraft((d) => ({ ...d, business: { ...d.business, ...patch } }))
  const setMarkets = (patch: Partial<SiteMarkets>) =>
    setDraft((d) => ({ ...d, markets: { ...d.markets, ...patch } }))
  const setTracking = (patch: Partial<TrackingConfig>) =>
    setDraft((d) => ({ ...d, tracking: { ...d.tracking, ...patch } }))
  const [marketQuery, setMarketQuery] = useState("")
  const { suggestions: marketSuggestions } = useLocationSuggestions(marketQuery)

  // Brand-asset uploads (logo + hero photo).
  const [logoUploading, setLogoUploading] = useState(false)
  const [heroUploading, setHeroUploading] = useState(false)
  const [assetError, setAssetError] = useState("")
  const logoInputRef = useRef<HTMLInputElement>(null)
  const heroInputRef = useRef<HTMLInputElement>(null)

  async function handleAssetUpload(
    file: File | undefined,
    setUploading: (v: boolean) => void,
    apply: (url: string) => void,
  ) {
    if (!file) return
    if (!siteId) {
      setAssetError("Save your progress first, then upload.")
      return
    }
    setAssetError("")
    setUploading(true)
    try {
      const url = await uploadSiteAsset(file, siteId)
      apply(url)
    } catch (e: any) {
      setAssetError(e?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const blockPatches = useMemo(
    () => [
      {
        blockType: "Hero",
        props: {
          headline: draft.content.headline,
          subhead: draft.content.subhead,
          ctaLabel: draft.content.ctaLabel,
          imageUrl: draft.content.heroImageUrl,
        },
      },
      {
        blockType: "Nav",
        props: {
          brandName: draft.content.brandName,
          phone: draft.content.phone?.trim() ? draft.content.phone : draft.business.phone,
          logoUrl: draft.theme.logoUrl || "",
          layout: draft.theme.headerLayout,
        },
      },
      { blockType: "Footer", props: { text: draft.content.footerText } },
      {
        blockType: "AnnouncementBar",
        props: {
          text: draft.content.announcementText,
          enabled: draft.theme.banner ? "show" : "hide",
        },
      },
    ],
    [draft],
  )

  async function saveDraft(): Promise<boolean> {
    if (!siteId) return true
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, theme: draft.theme, business: draft.business, markets: draft.markets, tracking: draft.tracking, blockPatches }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Failed to save changes")
      }
      return true
    } catch (e: any) {
      setError(e?.message || "Failed to save changes")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function ensureCreated(): Promise<boolean> {
    if (siteId) return true
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, persona: draft.persona, templateId: draft.templateId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Failed to create website")
      }
      const { site } = await res.json()
      setSiteId(site.id)
      setSlug(site.slug || "")
      setStatus(site.status || "draft")
      try {
        const r = await fetch(`/api/sites/${site.id}`)
        if (r.ok) {
          const { pages } = await r.json()
          setPages(toToggleable(pages))
        }
      } catch {}
      return true
    } catch (e: any) {
      setError(e?.message || "Failed to create website")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function togglePage(path: string, enabled: boolean) {
    setPages((prev) => prev.map((p) => (p.path === path ? { ...p, enabled } : p)))
    if (!siteId) return
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageUpdates: [{ path, enabled }] }),
      })
      if (!res.ok) throw new Error("Failed to update page")
    } catch (e: any) {
      setPages((prev) => prev.map((p) => (p.path === path ? { ...p, enabled: !enabled } : p)))
      setError(e?.message || "Failed to update page")
    }
  }

  async function handleContinue() {
    setError("")
    if (step === 0) {
      if (!draft.name.trim() || !draft.persona) return
      setStep(1)
      return
    }
    if (step === 1) {
      const ok = await ensureCreated()
      if (ok) setStep(2)
      return
    }
    if (step === 2 || step === 3 || step === 4 || step === 5) {
      const ok = await saveDraft()
      if (ok) setStep(step + 1)
      return
    }
  }

  function handleBack() {
    setError("")
    if (step === 0) {
      router.push("/websites")
      return
    }
    // Edit mode can't go back before the Brand step.
    if (isEdit && step <= 2) {
      router.push("/websites")
      return
    }
    setStep(step - 1)
  }

  async function handlePublish() {
    if (!siteId) return
    setSaving(true)
    setError("")
    try {
      const saved = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, theme: draft.theme, business: draft.business, markets: draft.markets, tracking: draft.tracking, blockPatches }),
      })
      if (!saved.ok) {
        const body = await saved.json().catch(() => ({}))
        throw new Error(body?.error || "Failed to save before publishing")
      }
      const res = await fetch(`/api/sites/${siteId}/publish`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Failed to publish")
      }
      const { site } = await res.json()
      setStatus(site?.status || "published")
      if (site?.slug) setSlug(site.slug)
      setPublished(true)
    } catch (e: any) {
      setError(e?.message || "Failed to publish")
    } finally {
      setSaving(false)
    }
  }

  const liveUrl = slug ? `https://${slug}.listhit.io` : ""
  const canContinue =
    step === 0
      ? Boolean(draft.name.trim() && draft.persona)
      : step === 1
        ? Boolean(draft.templateId)
        : step === 2
          ? draft.markets.scope === "nationwide" || draft.markets.markets.length > 0
          : step === 5
            ? Boolean(
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.business.email.trim()) &&
                  draft.business.phone.replace(/\D/g, "").length >= 10 &&
                  draft.business.address.trim() &&
                  draft.business.city.trim() &&
                  draft.business.state.trim().length === 2 &&
                  draft.business.zip.trim(),
              )
            : true

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Left rail */}
      <div className="flex w-full flex-col border-r border-border bg-background md:w-[440px] md:shrink-0">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Website studio</span>
          </div>
          <Link
            href="/websites"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Exit
          </Link>
        </div>

        {/* Stepper */}
        <div className="flex items-start border-b border-border px-4 py-3">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium",
                  i < step
                    ? "bg-brand text-white"
                    : i === step
                      ? "bg-background text-brand ring-2 ring-brand"
                      : "border border-border bg-background text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-center text-[11px] leading-tight",
                  i === step ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Step body */}
        <div className="flex-1 overflow-auto px-5 py-5">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 0 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="biz-name">Business name</Label>
                <Input
                  id="biz-name"
                  placeholder="Acme Home Buyers"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      name: e.target.value,
                      content: { ...d.content, brandName: e.target.value || "Your Company" },
                    }))
                  }
                />
                <p className="text-sm text-muted-foreground">
                  This shows at the top of every page — and on your Contact, Terms &amp; Privacy. Make sure it&apos;s exactly right.
                </p>
              </div>
              <div>
                <h2 className="text-base font-semibold">Who is this website for?</h2>
                <p className="text-sm text-muted-foreground">Pick the kind of buyers you want to collect — we&apos;ll tailor the site for them.</p>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {(Object.keys(PERSONAS) as SitePersona[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setDraft((d) => {
                          const next = getPersona(p)
                          return {
                            ...d,
                            persona: p,
                            content: {
                              ...d.content,
                              headline: next.headline,
                              subhead: next.subhead,
                              ctaLabel: next.ctaLabel,
                              announcementText: next.announcement,
                            },
                          }
                        })
                      }
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        draft.persona === p
                          ? "border-brand bg-brand/5"
                          : "border-border hover:bg-muted/60",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{getPersona(p).label}</span>
                        {draft.persona === p && <Check className="h-4 w-4 text-brand" />}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{PERSONA_BLURBS[p]}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Pick a look you like</h2>
                <p className="text-sm text-muted-foreground">Just a starting point — colors, words, and photos are all yours to change next.</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {ALL_SITE_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, templateId: t.id }))}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      draft.templateId === t.id ? "border-brand bg-brand/5" : "border-border hover:bg-muted/60",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <HeroThumb variant={t.heroVariant} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{t.name}</span>
                          {draft.templateId === t.id && <Check className="h-4 w-4 text-brand" />}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{TEMPLATE_BLURBS[t.id] || t.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">Make it look like yours</h2>
                <p className="text-sm text-muted-foreground">Colors, fonts, and header style — every choice updates the preview on the right.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Color palette</Label>
                <div className="grid grid-cols-4 gap-2">
                  {PALETTES.map((p) => {
                    const active = draft.theme.primary === p.primary && draft.theme.accent === p.accent
                    return (
                      <button
                        key={p.id}
                        type="button"
                        title={p.label}
                        onClick={() => setTheme({ primary: p.primary, accent: p.accent })}
                        className={cn(
                          "flex h-9 overflow-hidden rounded-lg border-2 transition",
                          active ? "border-foreground" : "border-transparent",
                        )}
                      >
                        <span className="flex-1" style={{ background: p.primary }} />
                        <span style={{ flex: ".55", background: p.accent }} />
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Pick a palette or set exact colors below.</p>
              </div>
              <ColorRow label="Primary color" value={draft.theme.primary} onChange={(v) => setTheme({ primary: v })} />
              <ColorRow label="Accent color" value={draft.theme.accent} onChange={(v) => setTheme({ accent: v })} />
              <div className="space-y-1.5">
                <Label>Type style</Label>
                <div className="space-y-2">
                  {TYPE_STYLES.map((t) => {
                    const active = draft.theme.typeStyleId === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          const fonts = resolveTypeFonts(t.id)
                          setTheme({ typeStyleId: t.id, headingFont: fonts.headingFont, bodyFont: fonts.bodyFont })
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border p-3 text-left transition",
                          active ? "border-brand ring-1 ring-brand" : "border-border hover:border-foreground/30",
                        )}
                      >
                        <span>
                          <span className="block text-xs text-muted-foreground">{t.label}</span>
                          <span className="block text-lg" style={{ fontFamily: t.headingFont }}>
                            Get the deal
                          </span>
                        </span>
                        {active && <Check className="h-4 w-4 text-brand" />}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Header layout</Label>
                <RadioGroup
                  value={draft.theme.headerLayout}
                  onValueChange={(v) => setTheme({ headerLayout: v as SiteTheme["headerLayout"] })}
                  className="flex gap-4"
                >
                  {(["split", "center", "stack"] as const).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm capitalize">
                      <RadioGroupItem value={opt} /> {opt}
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Show announcement banner</p>
                  <p className="text-xs text-muted-foreground">A thin promo strip at the top.</p>
                </div>
                <Switch checked={draft.theme.banner} onCheckedChange={(v) => setTheme({ banner: v })} />
              </div>
              {draft.theme.banner && (
                <div className="space-y-1.5">
                  <Label htmlFor="ann-text">Announcement text</Label>
                  <Input
                    id="ann-text"
                    value={draft.content.announcementText}
                    onChange={(e) => setContent({ announcementText: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Keep it buyer-facing — these sites collect buyers, not sellers.</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Logo</Label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={ASSET_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    handleAssetUpload(e.target.files?.[0], setLogoUploading, (url) => setTheme({ logoUrl: url }))
                    e.target.value = ""
                  }}
                />
                {draft.theme.logoUrl ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.theme.logoUrl}
                      alt="Logo preview"
                      className="h-10 w-auto max-w-[140px] rounded bg-white object-contain"
                    />
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={logoUploading}
                      >
                        {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Replace"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setTheme({ logoUrl: "" })}
                        disabled={logoUploading}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                  >
                    {logoUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" /> Upload logo
                      </>
                    )}
                  </Button>
                )}
                <details className="group">
                  <summary className="cursor-pointer list-none text-xs text-muted-foreground hover:text-foreground">
                    or paste a URL
                  </summary>
                  <Input
                    className="mt-2"
                    placeholder="https://…/logo.png"
                    value={draft.theme.logoUrl || ""}
                    onChange={(e) => setTheme({ logoUrl: e.target.value })}
                  />
                </details>
                {assetError && <p className="text-xs text-destructive">{assetError}</p>}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">Your words</h2>
                <p className="text-sm text-muted-foreground">Edit anything, or keep what we wrote.</p>
              </div>
              <Field label="Headline">
                <Input value={draft.content.headline} onChange={(e) => setContent({ headline: e.target.value })} />
              </Field>
              <Field label="Subhead">
                <Input value={draft.content.subhead} onChange={(e) => setContent({ subhead: e.target.value })} />
              </Field>
              <Field label="Button label">
                <Input value={draft.content.ctaLabel} onChange={(e) => setContent({ ctaLabel: e.target.value })} />
              </Field>
              <Field label="Footer text">
                <Input value={draft.content.footerText} onChange={(e) => setContent({ footerText: e.target.value })} />
              </Field>
              <div className="space-y-1.5">
                <Label>Hero image</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CURATED_HERO_IMAGES.map((img) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => setContent({ heroImageUrl: img.url })}
                      className={cn(
                        "relative aspect-video overflow-hidden rounded-md border-2",
                        draft.content.heroImageUrl === img.url ? "border-brand" : "border-transparent",
                      )}
                      title={img.label}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.label} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
                <input
                  ref={heroInputRef}
                  type="file"
                  accept={ASSET_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    handleAssetUpload(e.target.files?.[0], setHeroUploading, (url) => setContent({ heroImageUrl: url }))
                    e.target.value = ""
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => heroInputRef.current?.click()}
                  disabled={heroUploading}
                >
                  {heroUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" /> Upload your own photo
                    </>
                  )}
                </Button>
                <Input
                  className="mt-2"
                  placeholder="Or paste an image URL"
                  value={draft.content.heroImageUrl}
                  onChange={(e) => setContent({ heroImageUrl: e.target.value })}
                />
                {assetError && <p className="text-xs text-destructive">{assetError}</p>}
              </div>
              {pages.length > 0 && (
                <div className="space-y-2">
                  <Label>Pages</Label>
                  <p className="text-xs text-muted-foreground">Turn extra pages on or off — they show in your menu when on.</p>
                  {pages.map((p) => (
                    <div key={p.path} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm font-medium">{p.nav_label}</span>
                      <Switch checked={p.enabled} onCheckedChange={(v) => togglePage(p.path, v)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">Where do you buy houses?</h2>
                <p className="text-sm text-muted-foreground">
                  This helps local buyers find you on Google. Not sure? Pick Anywhere — you can add areas anytime.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setMarkets({ scope: "nationwide" })}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    draft.markets.scope === "nationwide" ? "border-brand bg-brand/5" : "border-border hover:bg-muted/60",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Nationwide</span>
                    {draft.markets.scope === "nationwide" && <Check className="h-4 w-4 text-brand" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">We work across the U.S.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMarkets({ scope: "specific" })}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    draft.markets.scope === "specific" ? "border-brand bg-brand/5" : "border-border hover:bg-muted/60",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Specific markets</span>
                    {draft.markets.scope === "specific" && <Check className="h-4 w-4 text-brand" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">Target specific cities, counties, or states.</p>
                </button>
              </div>

              <div className="space-y-2">
                {draft.markets.scope === "nationwide" ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Your site positions as nationwide — buyers anywhere can join your list.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Optional: add the states you want to rank in. We&apos;ll build a dedicated location page for each and link to them from your home page. Your home page stays nationwide — these just help you show up in state-level searches.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Add the cities, counties, or states you source and market deals in.
                  </p>
                )}
                {draft.markets.markets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {draft.markets.markets.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand"
                      >
                        {formatMarketLabel(m)}
                        <button
                          type="button"
                          onClick={() => setMarkets({ markets: draft.markets.markets.filter((x) => x !== m) })}
                          aria-label={`Remove ${formatMarketLabel(m)}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Input
                    placeholder="City, county, or state"
                    value={marketQuery}
                    onChange={(e) => setMarketQuery(e.target.value)}
                    disabled={draft.markets.markets.length >= 25}
                  />
                  {marketQuery.trim().length > 1 && marketSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-md">
                      {marketSuggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            if (!draft.markets.markets.includes(s) && draft.markets.markets.length < 25) {
                              setMarkets({ markets: [...draft.markets.markets, s] })
                            }
                            setMarketQuery("")
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">Get set up to text your list</h2>
                <p className="text-sm text-muted-foreground">
                  We use this to automatically build your Contact page and your Terms of Use and Privacy Policy — what
                  carriers check before approving you to send texts.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                We add the exact wording carriers require so your texts get delivered, not blocked — this is what gets you 10DLC approved.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Business email *">
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={draft.business.email}
                    onChange={(e) => setBusiness({ email: e.target.value })}
                  />
                </Field>
                <Field label="Business phone *">
                  <Input
                    placeholder="(555) 555-5555"
                    value={draft.business.phone}
                    onChange={(e) => setBusiness({ phone: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {"Your business contact number. It appears on your texting application and on your site — keep it the same on both. Your existing number is fine; you'll get a dedicated texting number after approval that you can switch to."}
                  </p>
                </Field>
              </div>

              <Field label="Street address *">
                <Input
                  placeholder="123 Main St"
                  value={draft.business.address}
                  onChange={(e) => setBusiness({ address: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="City *">
                  <Input value={draft.business.city} onChange={(e) => setBusiness({ city: e.target.value })} />
                </Field>
                <Field label="State *">
                  <Input
                    maxLength={2}
                    placeholder="GA"
                    value={draft.business.state}
                    onChange={(e) => setBusiness({ state: e.target.value.toUpperCase() })}
                  />
                </Field>
                <Field label="ZIP *">
                  <Input value={draft.business.zip} onChange={(e) => setBusiness({ zip: e.target.value })} />
                </Field>
              </div>

              <div className="space-y-2">
                <Label>Social links (optional)</Label>
                <Input
                  placeholder="Facebook URL"
                  value={draft.business.social.facebook || ""}
                  onChange={(e) => setBusiness({ social: { ...draft.business.social, facebook: e.target.value } })}
                />
                <Input
                  placeholder="Instagram URL"
                  value={draft.business.social.instagram || ""}
                  onChange={(e) => setBusiness({ social: { ...draft.business.social, instagram: e.target.value } })}
                />
                <Input
                  placeholder="YouTube URL"
                  value={draft.business.social.youtube || ""}
                  onChange={(e) => setBusiness({ social: { ...draft.business.social, youtube: e.target.value } })}
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">SMS opt-in &amp; consent</span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Required for texting approval — always on. These can&apos;t be edited or turned off; they&apos;re
                  what gets your texts delivered.
                </p>
                <div className="mt-3 space-y-2">
                  {(() => {
                    const consent = buildConsentTexts(draft.content.brandName || draft.name || "your business")
                    return [consent.marketing, consent.nonMarketing].map((text, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-md border border-border bg-background p-2.5">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border" />
                        <span className="text-xs leading-relaxed text-muted-foreground">{text}</span>
                      </div>
                    ))
                  })()}
                </div>
              </div>

              {/* Tracking & ads */}
              <div className="space-y-3 border-t border-border pt-5">
                <div>
                  <h2 className="text-base font-semibold">Tracking &amp; ads</h2>
                  <p className="text-sm text-muted-foreground">
                    Paste the IDs from your ad accounts — we&apos;ll fire a conversion automatically when someone joins
                    your buyers list. Leave blank if you&apos;re not running ads.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Google Analytics 4 — Measurement ID</Label>
                  <Input
                    placeholder="G-XXXXXXX"
                    value={draft.tracking.ga4_id || ""}
                    onChange={(e) => setTracking({ ga4_id: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Google Ads — Conversion ID</Label>
                    <Input
                      placeholder="AW-XXXXXXXXX"
                      value={draft.tracking.google_ads_id || ""}
                      onChange={(e) => setTracking({ google_ads_id: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Google Ads — Conversion label</Label>
                    <Input
                      placeholder="abcDEF123"
                      value={draft.tracking.google_ads_label || ""}
                      onChange={(e) => setTracking({ google_ads_label: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Meta Pixel ID</Label>
                  <Input
                    placeholder="15–16 digit number"
                    value={draft.tracking.meta_pixel_id || ""}
                    onChange={(e) => setTracking({ meta_pixel_id: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-5">
              {!published ? (
                <>
                  <div>
                    <h2 className="text-base font-semibold">Ready to launch</h2>
                    <p className="text-sm text-muted-foreground">Your site will go live at this address.</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <p className="text-xs text-muted-foreground">Publish address</p>
                    <p className="mt-1 font-mono text-sm font-medium">
                      {slug ? `${slug}.listhit.io` : "—"}
                    </p>
                  </div>
                  <Button type="button" variant="brand" className="w-full" onClick={handlePublish} disabled={saving || !siteId}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Publishing…
                      </>
                    ) : status === "published" ? (
                      "Republish website"
                    ) : (
                      "Publish website"
                    )}
                  </Button>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
                      <Check className="h-6 w-6 text-brand" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">Your website is live</h2>
                      <p className="text-sm text-muted-foreground">Share your link, or connect your own domain below.</p>
                    </div>
                    {liveUrl && (
                      <div className="flex items-center justify-center gap-2">
                        <a
                          href={liveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
                        >
                          {liveUrl.replace("https://", "")}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5"
                          onClick={() => {
                            navigator.clipboard?.writeText(liveUrl).catch(() => {})
                            setCopiedLive(true)
                            setTimeout(() => setCopiedLive(false), 1500)
                          }}
                        >
                          {copiedLive ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedLive ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    )}
                  </div>

                  {siteId && (
                    <div className="space-y-2 text-left">
                      <div>
                        <h3 className="text-sm font-semibold">Use your own domain (optional)</h3>
                        <p className="text-xs text-muted-foreground">
                          Connect a domain like yourcompany.com. Add it, drop in the DNS record we show you, and we&apos;ll
                          flip it to Connected automatically once it&apos;s pointing here.
                        </p>
                      </div>
                      <CustomDomainCard siteId={siteId} slug={slug} />
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-2 text-center">
                    {fromOnboarding && (
                      <Button type="button" variant="brand" onClick={() => router.push("/getting-started/website")}>
                        Finish setup <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                    <Button asChild variant={fromOnboarding ? "outline" : "brand"}>
                      <Link href="/websites">Done</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        {!(step === 6 && published) && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <Button type="button" variant="ghost" onClick={handleBack} disabled={saving}>
              <ArrowLeft className="h-4 w-4" />
              {step === 0 || (isEdit && step <= 2) ? "Exit" : "Back"}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setMobilePreview((v) => !v)}
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              {step < 6 && (
                <Button type="button" variant="brand" onClick={handleContinue} disabled={saving || !canContinue}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className={cn("flex-1 overflow-hidden", mobilePreview ? "block" : "hidden md:block")}>
        <SitePreview
          templateId={draft.templateId}
          persona={draft.persona}
          theme={draft.theme}
          content={draft.content}
          business={draft.business}
          markets={draft.markets}
          navPages={pages.filter((p) => p.enabled).map((p) => ({ path: p.path, navLabel: p.nav_label }))}
        />
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-background"
          aria-label={`${label} swatch`}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  )
}

function HeroThumb({ variant }: { variant: string }) {
  // Tiny CSS representation of each hero layout.
  const base = "h-14 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
  if (variant === "photo") {
    return (
      <div className={cn(base, "relative bg-gradient-to-br from-slate-400 to-slate-600")}>
        <div className="absolute right-1 top-2 h-9 w-7 rounded-sm bg-white/90" />
      </div>
    )
  }
  if (variant === "centered") {
    return (
      <div className={cn(base, "flex flex-col items-center justify-center gap-1")}>
        <div className="h-1.5 w-10 rounded-sm bg-foreground/40" />
        <div className="h-3 w-12 rounded-sm bg-foreground/15" />
      </div>
    )
  }
  if (variant === "split") {
    return (
      <div className={cn(base, "flex")}>
        <div className="flex-1 bg-white/80" />
        <div className="flex-1 bg-slate-500" />
      </div>
    )
  }
  // band
  return (
    <div className={cn(base, "flex flex-col")}>
      <div className="h-7 bg-slate-700" />
      <div className="flex-1 bg-white/80" />
    </div>
  )
}
