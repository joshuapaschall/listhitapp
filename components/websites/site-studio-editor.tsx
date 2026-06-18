"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Puck, usePuck, Render, type Data } from "@measured/puck"
import "@measured/puck/puck.css"
import { siteConfig } from "@/lib/site-builder/blocks/config"
import { SiteContextProvider, type SiteFormContext } from "@/lib/site-builder/site-context"
import { buildConsentTexts } from "@/lib/site-builder/compliance"
import { mergeThemeIntoRoot } from "@/lib/site-builder/resolve-site"
import { TYPE_STYLES, resolveTypeFonts } from "@/lib/site-builder/typography"
import type { SiteBusiness, SiteMarkets, SitePersona, SiteTheme } from "@/lib/site-builder/types"
import { TemplateSwitcher, type TemplateMeta } from "@/components/websites/template-switcher"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
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
  business, markets, persona, navLinks, city, publicUrl, pageItems,
  theme, templateId, templates,
}: {
  siteId: string; slug: string; siteName: string; status: string; pages: EditablePage[]
  business: SiteBusiness
  markets: SiteMarkets
  persona: SitePersona
  navLinks: { label: string; href: string }[]
  city: string
  publicUrl?: string
  pageItems: { path: string; label: string; enabled: boolean; locked: boolean }[]
  theme: SiteTheme
  templateId: string
  templates: TemplateMeta[]
}) {
  const router = useRouter()
  const published = status === "published"
  const [mode, setMode] = useState<"content" | "pages" | "design">("content")
  const [pageState, setPageState] = useState(pageItems)
  const [themeDraft, setThemeDraft] = useState<SiteTheme>(theme)
  const [themeDirty, setThemeDirty] = useState(false)
  const [savingTheme, setSavingTheme] = useState(false)
  function patchTheme(p: Partial<SiteTheme>) {
    setThemeDraft((t) => ({ ...t, ...p }))
    setThemeDirty(true)
  }
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
  const liveUrl = publicUrl || ""

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

  // Native "Leave site?" prompt on refresh/close while there are unsaved edits
  // (content edits or unsaved brand changes).
  useEffect(() => {
    if (!dirty && !themeDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty, themeDirty])

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
      // Refresh the stored screenshot to reflect the saved content (fire-and-forget).
      fetch(`/api/sites/${siteId}/thumbnail`, { method: "POST" }).catch(() => {})
    } catch (e: any) {
      setError(e?.message || "Failed to save changes")
    } finally { setSaving(false) }
  }

  function handleBack() {
    if (dirty || themeDirty) { setShowLeave(true); return }
    router.push(`/websites/${siteId}`)
  }

  // Optimistic page on/off, mirroring the Edit hub. Rolls back on failure.
  async function togglePage(path: string, next: boolean) {
    setPageState((prev) => prev.map((p) => (p.path === path ? { ...p, enabled: next } : p)))
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageUpdates: [{ path, enabled: next }] }),
      })
      if (!res.ok) throw new Error()
      toast.success(next ? "Page turned on." : "Page turned off.")
    } catch {
      setPageState((prev) => prev.map((p) => (p.path === path ? { ...p, enabled: !next } : p)))
      toast.error("Couldn't update that page.")
    }
  }

  // Persist the brand to canonical theme_json (what the public site renders from).
  async function saveTheme() {
    setSavingTheme(true)
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: {
            primary: themeDraft.primary, accent: themeDraft.accent,
            headingFont: themeDraft.headingFont, bodyFont: themeDraft.bodyFont,
            typeStyleId: themeDraft.typeStyleId,
          },
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("Brand saved.")
      setThemeDirty(false)
    } catch { toast.error("Couldn't save brand.") }
    finally { setSavingTheme(false) }
  }

  const homeData = pages.find((p) => p.path === "/")?.data ?? pages[0]?.data
  const PRIMARY_PRESETS = ["#102a54", "#0f5132", "#7a1f2b", "#3d2b56", "#1a1a1a"]
  const ACCENT_PRESETS = ["#3b82f6", "#f5a623", "#e8833a", "#16a34a"]

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
        <div className="flex min-h-0 flex-1">
          {/* Left rail — mode switch */}
          <nav className="flex w-[140px] flex-none flex-col gap-1 border-r border-border p-2">
            <button
              type="button"
              onClick={() => setMode("content")}
              className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                mode === "content" ? "bg-brand/10 text-brand" : "text-muted-foreground hover:bg-muted")}
            >Content</button>
            <button
              type="button"
              onClick={() => setMode("design")}
              className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                mode === "design" ? "bg-brand/10 text-brand" : "text-muted-foreground hover:bg-muted")}
            >Design</button>
            <button
              type="button"
              onClick={() => setMode("pages")}
              className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                mode === "pages" ? "bg-brand/10 text-brand" : "text-muted-foreground hover:bg-muted")}
            >Pages</button>
          </nav>

          {/* Content mode — Puck stays MOUNTED; hidden via CSS when not active */}
          <div
            className={cn("grid min-h-0 flex-1", mode !== "content" && "hidden")}
            style={{ gridTemplateColumns: "1fr 320px" }}
          >
            <div className="min-w-0 overflow-auto"><Puck.Preview /></div>
            <div className="overflow-auto border-l border-border"><Puck.Fields /></div>
          </div>

          {/* Design mode — live preview uses <Render> (not Puck.Preview), safe to mount/unmount */}
          {mode === "design" && (
            <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "360px 1fr" }}>
              {/* Controls */}
              <div className="space-y-6 overflow-auto border-r border-border p-5">
                <TemplateSwitcher siteId={siteId} currentTemplateId={templateId} templates={templates} />

                <div className="space-y-2">
                  <Label>Primary color</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {PRIMARY_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Primary ${c}`}
                        onClick={() => patchTheme({ primary: c })}
                        className={cn("h-8 w-8 rounded-md border-2", themeDraft.primary === c ? "border-foreground" : "border-transparent")}
                        style={{ background: c }}
                      />
                    ))}
                    <Input
                      value={themeDraft.primary}
                      onChange={(e) => patchTheme({ primary: e.target.value })}
                      className="w-28 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Accent color</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {ACCENT_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Accent ${c}`}
                        onClick={() => patchTheme({ accent: c })}
                        className={cn("h-8 w-8 rounded-md border-2", themeDraft.accent === c ? "border-foreground" : "border-transparent")}
                        style={{ background: c }}
                      />
                    ))}
                    <Input
                      value={themeDraft.accent}
                      onChange={(e) => patchTheme({ accent: e.target.value })}
                      className="w-28 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="font-pairing">Font pairing</Label>
                  <select
                    id="font-pairing"
                    value={themeDraft.typeStyleId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value
                      const f = resolveTypeFonts(id)
                      patchTheme({ typeStyleId: id, headingFont: f.headingFont, bodyFont: f.bodyFont })
                    }}
                    className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {TYPE_STYLES.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <Button type="button" variant="brand" onClick={saveTheme} disabled={!themeDirty || savingTheme}>
                  {savingTheme ? "Saving…" : "Save brand"}
                </Button>
              </div>

              {/* Live preview — restyles instantly from the draft theme */}
              <div className="min-w-0 overflow-auto p-4">
                <div className="overflow-auto rounded-lg border border-border">
                  <Render config={siteConfig as any} data={mergeThemeIntoRoot(homeData, themeDraft)} />
                </div>
              </div>
            </div>
          )}

          {/* Pages mode — a plain panel, safe to mount/unmount */}
          {mode === "pages" && (
            <div className="min-h-0 flex-1 overflow-auto p-6">
              <div className="mx-auto max-w-xl">
                <h2 className="text-sm font-semibold">Pages</h2>
                <p className="mb-3 text-xs text-muted-foreground">Turn optional pages on or off. Legal pages stay on for compliance.</p>
                <div className="rounded-xl border border-border">
                  {pageState.map((p) => (
                    <div key={p.path} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0">
                      <div>
                        <div className="text-sm font-medium">{p.label}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{p.path}</div>
                      </div>
                      {p.locked ? (
                        <span className="text-xs text-muted-foreground">Always on</span>
                      ) : (
                        <Switch checked={p.enabled} onCheckedChange={(v) => togglePage(p.path, v)} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
