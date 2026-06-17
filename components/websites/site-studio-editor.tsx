"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Puck, usePuck, type Data } from "@measured/puck"
import "@measured/puck/puck.css"
import { siteConfig } from "@/lib/site-builder/blocks/config"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import { buildConsentTexts } from "@/lib/site-builder/compliance"
import type { SiteBusiness, SiteMarkets, SitePersona } from "@/lib/site-builder/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowLeft, Loader2, Check, ExternalLink } from "lucide-react"

type EditablePage = { path: string; label: string; data: Data }

// Lives inside the <Puck> context and switches the edited document in place when
// the active page tab changes. Puck mounts with the initial page's data, so the
// first run is skipped; afterwards each tab change dispatches setData — avoiding
// a full <Puck> remount (and the iframe teardown crash that came with it).
function StudioDataSync({
  activePath,
  dataByPath,
}: {
  activePath: string
  dataByPath: React.MutableRefObject<Record<string, Data>>
}) {
  const { dispatch } = usePuck()
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const next = dataByPath.current[activePath]
    if (next) dispatch({ type: "setData", data: next })
  }, [activePath, dispatch, dataByPath])
  return null
}

export function SiteStudioEditor({
  siteId, slug, siteName, status, pages,
  business, markets, persona, navLinks, city,
}: {
  siteId: string; slug: string; siteName: string; status: string; pages: EditablePage[]
  business: SiteBusiness
  markets: SiteMarkets
  persona: SitePersona
  navLinks: { label: string; href: string }[]
  city: string
}) {
  const router = useRouter()
  const published = status === "published"
  const [activePath, setActivePath] = useState(pages[0]?.path || "/")
  const dataByPath = useRef<Record<string, Data>>(
    Object.fromEntries(pages.map((p) => [p.path, p.data])),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  // Dirty tracking: dirtyRef gates the onChange hot path so we only flip React
  // state on the clean→dirty transition, not on every keystroke.
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const [showLeave, setShowLeave] = useState(false)
  const liveUrl = slug ? `https://${slug}.listhit.io` : ""

  const brand = siteName || "our team"

  const form = useMemo<SiteFormContext>(() => {
    const consent = buildConsentTexts(brand)
    return {
      siteId,
      persona,
      brandName: brand,
      optinEnabled: true,
      requireConsent: true,
      disclosure: consent.marketing,
      consentMarketing: consent.marketing,
      consentNonMarketing: consent.nonMarketing,
      legalPaths: { terms: "/terms", privacy: "/privacy" },
      markets,
      deals: [],
      business,
      navLinks: navLinks || [],
    }
  }, [siteId, brand, persona, markets, business, navLinks])

  // Display-only interpolation of {Brand}/{City} — applies inside <Puck> only,
  // never to <Render> or the saved data (Puck FieldTransforms semantics).
  const fieldTransforms = useMemo(() => {
    const interp = (v: any) =>
      typeof v === "string" ? v.split("{Brand}").join(brand).split("{City}").join(city) : v
    return {
      text: ({ value }: any) => interp(value),
      textarea: ({ value }: any) => interp(value),
    }
  }, [brand, city])

  // Native "Leave site?" prompt on refresh/close while there are unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  // savePageData writes straight to site_pages.puck_data — what the public site
  // renders. There's no draft buffer, so for a published site this IS live.
  async function publishChanges() {
    setSaving(true); setError(""); setSaved(false)
    try {
      for (const p of pages) {
        const res = await fetch(`/api/sites/${siteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageData: { path: p.path, data: dataByPath.current[p.path] } }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to save")
      }
      const pub = await fetch(`/api/sites/${siteId}/publish`, { method: "POST" })
      if (!pub.ok) throw new Error((await pub.json().catch(() => ({})))?.error || "Failed to publish")
      dirtyRef.current = false; setDirty(false)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e?.message || "Failed to save changes")
    } finally { setSaving(false) }
  }

  function handleBack() {
    if (dirty) { setShowLeave(true); return }
    router.push(`/websites/${siteId}`)
  }

  return (
    <SiteContextProvider value={form}>
    <Puck
      config={siteConfig as any}
      data={dataByPath.current[activePath]}
      onChange={(d: Data) => {
        dataByPath.current[activePath] = d
        if (!dirtyRef.current) { dirtyRef.current = true; setDirty(true) }
      }}
      permissions={{ insert: false }}
      fieldTransforms={fieldTransforms as any}
    >
      <StudioDataSync activePath={activePath} dataByPath={dataByPath} />
      <div className="flex h-screen flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <span className="truncate font-semibold">{siteName}</span>
            <span className="text-xs capitalize text-muted-foreground">{status}</span>
          </div>
          {pages.length > 1 && (
            <div className="flex items-center gap-1.5">
              {pages.map((p) => (
                <button
                  key={p.path}
                  type="button"
                  onClick={() => setActivePath(p.path)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
                    p.path === activePath
                      ? "border-brand bg-brand text-white"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes
              </span>
            ) : saved ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            ) : null}
            {liveUrl && (
              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
              >
                View site <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {published && (
              <span className="hidden text-xs text-muted-foreground md:inline">Changes go live immediately.</span>
            )}
            <Button variant="brand" size="sm" onClick={publishChanges} disabled={saving}>
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {published ? "Saving…" : "Publishing…"}</>
              ) : saved ? (
                <><Check className="h-4 w-4" /> {published ? "Saved" : "Published"}</>
              ) : published ? (
                "Save changes"
              ) : (
                "Publish site"
              )}
            </Button>
          </div>
        </div>
        {error && <div className="bg-destructive/10 px-4 py-2 text-[13px] text-destructive">{error}</div>}
        <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "1fr 320px" }}>
          <div className="min-w-0 overflow-auto"><Puck.Preview /></div>
          <div className="overflow-auto border-l border-border"><Puck.Fields /></div>
        </div>
      </div>
    </Puck>

    {showLeave && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-lg">
          <h2 id="leave-title" className="text-base font-semibold">Leave with unsaved changes?</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            You&apos;ve made edits that aren&apos;t saved yet. If you leave now, you&apos;ll lose them.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowLeave(false)}>
              Keep editing
            </Button>
            <Button type="button" variant="brand" size="sm" onClick={() => router.push(`/websites/${siteId}`)}>
              Discard &amp; leave
            </Button>
          </div>
        </div>
      </div>
    )}
    </SiteContextProvider>
  )
}
