"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export type TemplateMeta = {
  id: string
  name: string
  description: string
  heroVariant: "photo" | "centered" | "split" | "band"
  primary: string
  accent: string
}

function Preview({
  variant,
  primary,
  accent,
}: {
  variant: TemplateMeta["heroVariant"]
  primary: string
  accent: string
}) {
  const nav = (
    <div style={{ height: 14, background: primary, display: "flex", alignItems: "center", padding: "0 8px", gap: 5 }}>
      <span style={{ width: 18, height: 4, background: "rgba(255,255,255,.85)", borderRadius: 2 }} />
      <span style={{ marginLeft: "auto", width: 10, height: 4, background: "rgba(255,255,255,.5)", borderRadius: 2 }} />
      <span style={{ width: 10, height: 4, background: "rgba(255,255,255,.5)", borderRadius: 2 }} />
    </div>
  )
  const formCard = (
    <div style={{ background: "#fff", borderRadius: 5, padding: 6, display: "flex", flexDirection: "column", gap: 4, width: 62 }}>
      <span style={{ height: 5, background: "#dfe4ea", borderRadius: 2 }} />
      <span style={{ height: 9, background: accent, borderRadius: 2 }} />
    </div>
  )
  let body: React.ReactNode = null
  if (variant === "photo") {
    body = (
      <div style={{ position: "relative", flex: 1, background: "#c4ccd5" }}>
        <div style={{ position: "absolute", left: 8, top: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ width: 70, height: 7, background: "rgba(255,255,255,.9)", borderRadius: 2 }} />
          <span style={{ width: 48, height: 5, background: "rgba(255,255,255,.7)", borderRadius: 2 }} />
        </div>
        <div style={{ position: "absolute", left: 8, bottom: 8 }}>{formCard}</div>
      </div>
    )
  } else if (variant === "centered") {
    body = (
      <div style={{ flex: 1, background: "#f4f6f9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}>
        <span style={{ width: 90, height: 7, background: primary, borderRadius: 2 }} />
        <span style={{ width: 64, height: 5, background: "#c4ccd5", borderRadius: 2 }} />
        <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
          <span style={{ width: 60, height: 11, background: "#fff", border: "1px solid #dfe4ea", borderRadius: 3 }} />
          <span style={{ width: 34, height: 11, background: accent, borderRadius: 3 }} />
        </div>
      </div>
    )
  } else if (variant === "split") {
    body = (
      <div style={{ flex: 1, display: "flex" }}>
        <div style={{ flex: 1, background: "#f4f6f9", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, padding: 8 }}>
          <span style={{ width: 54, height: 6, background: primary, borderRadius: 2 }} />
          {formCard}
        </div>
        <div style={{ flex: 1, background: "#c4ccd5", position: "relative" }}>
          <span style={{ position: "absolute", right: 6, top: 6, background: accent, color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 999 }}>
            $0 down
          </span>
        </div>
      </div>
    )
  } else {
    body = (
      <div style={{ flex: 1, background: primary, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}>
        <span style={{ width: 92, height: 7, background: "rgba(255,255,255,.92)", borderRadius: 2 }} />
        <span style={{ width: 60, height: 5, background: "rgba(255,255,255,.6)", borderRadius: 2 }} />
        <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
          <span style={{ width: 60, height: 11, background: "#fff", borderRadius: 3 }} />
          <span style={{ width: 38, height: 11, background: accent, borderRadius: 3 }} />
        </div>
      </div>
    )
  }
  return (
    <div style={{ height: 120, display: "flex", flexDirection: "column", borderRadius: 8, overflow: "hidden" }}>
      {nav}
      {body}
    </div>
  )
}

export function TemplateSwitcher({
  siteId,
  currentTemplateId,
  templates,
}: {
  siteId: string
  currentTemplateId: string
  templates: TemplateMeta[]
}) {
  const router = useRouter()
  const [current, setCurrent] = useState(currentTemplateId)
  const [pending, setPending] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pendingTpl = templates.find((t) => t.id === pending) || null

  async function confirmSwitch() {
    if (!pending) return
    const target = pending
    setBusy(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: target }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error || "Couldn't switch template.")
      } else {
        setCurrent(target)
        toast.success(`Switched to ${templates.find((t) => t.id === target)?.name || "new template"}.`)
        router.refresh()
      }
    } catch {
      toast.error("Couldn't switch template.")
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">Template</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Switch the look of your site. Your logo, text, listings, blog, and domain stay — only the layout and style change.
      </p>

      <div className="mt-4 grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(238px, 1fr))" }}>
        {templates.map((t) => {
          const isCur = t.id === current
          return (
            <div key={t.id} className={`overflow-hidden rounded-lg border ${isCur ? "border-2 border-blue-500" : "border-border"}`}>
              <Preview variant={t.heroVariant} primary={t.primary} accent={t.accent} />
              <div className="p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: t.primary }} />
                    {t.name}
                  </span>
                  {isCur ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">Current</span>
                  ) : null}
                </div>
                <p className="min-h-[34px] text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                <div className="mt-2.5">
                  {isCur ? (
                    <Button variant="outline" size="sm" disabled>
                      In use
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setPending(t.id)}>
                      Use this template
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {pendingTpl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5" role="dialog" aria-modal="true">
          <div className="w-full max-w-[380px] rounded-lg bg-background p-6 shadow-xl">
            <div className="mb-2 text-base font-medium">Switch to {pendingTpl.name}?</div>
            <p className="mb-1.5 text-sm leading-relaxed text-muted-foreground">
              Your site will adopt {pendingTpl.name}&rsquo;s layout, hero style, and colors.
            </p>
            <p className="mb-1.5 text-sm leading-relaxed">
              <span className="font-medium text-green-600">Kept:</span>{" "}
              <span className="text-muted-foreground">your logo, text, listings, blog, and domain</span>
            </p>
            <p className="mb-4 text-sm leading-relaxed">
              <span className="font-medium text-amber-600">Replaced:</span>{" "}
              <span className="text-muted-foreground">any custom tweaks you made in the site editor</span>
            </p>
            <div className="flex justify-end gap-2.5">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button size="sm" disabled={busy} onClick={confirmSwitch}>
                {busy ? "Switching…" : `Switch to ${pendingTpl.name}`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
