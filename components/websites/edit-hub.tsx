"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { TemplateSwitcher, type TemplateMeta } from "@/components/websites/template-switcher"

type EditHubPage = { path: string; label: string; enabled: boolean; locked: boolean }

type SectionKey = "content" | "design" | "pages"
const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "content", label: "Content" },
  { key: "design", label: "Design" },
  { key: "pages", label: "Pages" },
]

export function EditHub({
  siteId,
  siteName,
  status,
  personaLabel,
  primary,
  accent,
  currentTemplateId,
  templates,
  pages,
}: {
  siteId: string
  siteName: string
  status: string
  slug: string
  personaLabel: string
  primary: string
  accent: string
  currentTemplateId: string
  templates: TemplateMeta[]
  pages: EditHubPage[]
}) {
  const [active, setActive] = useState<SectionKey>("content")
  const [pageState, setPageState] = useState<EditHubPage[]>(pages)
  const published = status === "published"

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

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      {/* Sub-nav */}
      <nav className="flex gap-1 md:flex-col">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(s.key)}
            className={cn(
              "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
              active === s.key
                ? "bg-brand/10 text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Panel */}
      <div className="min-w-0">
        {active === "content" && (
          <Card className="space-y-5 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Content</h2>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  published ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
                )}
              >
                {published ? "Live" : "Draft"}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <div className="flex h-44 items-center justify-center px-4" style={{ background: primary }}>
                <span className="text-center text-lg font-semibold text-white">{siteName}</span>
              </div>
              <p className="bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
                A live preview of your saved site is coming soon.
              </p>
            </div>

            <div className="space-y-2">
              <Button asChild variant="brand">
                <Link href={`/websites/${siteId}/studio`}>Open editor</Link>
              </Button>
              <p className="text-xs text-muted-foreground">Edit your headlines, photos, sections, and signup form.</p>
            </div>
          </Card>
        )}

        {active === "design" && (
          <div className="space-y-6">
            <TemplateSwitcher siteId={siteId} currentTemplateId={currentTemplateId} templates={templates} />

            <Card className="space-y-4 p-5">
              <h2 className="text-sm font-semibold">Brand</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Brand colors</div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Swatch color={primary} label="Primary" />
                    <Swatch color={accent} label="Accent" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Audience</div>
                  <div className="mt-1 text-sm font-medium text-foreground">{personaLabel}</div>
                </div>
              </div>
              <Button asChild variant="outline">
                <Link href={`/websites/${siteId}/edit`}>Edit brand &amp; details</Link>
              </Button>
            </Card>
          </div>
        )}

        {active === "pages" && (
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">
              Turn optional pages on or off — they appear in your site menu when on. Legal pages stay on for compliance.
            </p>
            <div className="mt-4 divide-y divide-border">
              {pageState.map((p) => (
                <div key={p.path} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{p.label}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{p.path}</div>
                  </div>
                  {p.locked ? (
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">Always on</span>
                  ) : (
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={(v) => togglePage(p.path, v)}
                      aria-label={`Show ${p.label} in the site menu`}
                    />
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-6 w-6 rounded-md border border-border" style={{ background: color }} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
