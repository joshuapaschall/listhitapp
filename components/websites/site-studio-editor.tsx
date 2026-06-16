"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Puck, usePuck, type Data } from "@measured/puck"
import "@measured/puck/puck.css"
import { siteConfig } from "@/lib/site-builder/blocks/config"
import { Button } from "@/components/ui/button"
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
}: {
  siteId: string; slug: string; siteName: string; status: string; pages: EditablePage[]
}) {
  const router = useRouter()
  const [activePath, setActivePath] = useState(pages[0]?.path || "/")
  const dataByPath = useRef<Record<string, Data>>(
    Object.fromEntries(pages.map((p) => [p.path, p.data])),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const liveUrl = slug ? `https://${slug}.listhit.io` : ""

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
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e?.message || "Failed to publish changes")
    } finally { setSaving(false) }
  }

  return (
    <Puck
      config={siteConfig as any}
      data={dataByPath.current[activePath]}
      onChange={(d: Data) => { dataByPath.current[activePath] = d }}
      permissions={{ insert: false }}
    >
      <StudioDataSync activePath={activePath} dataByPath={dataByPath} />
      <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--border, #e5e7eb)", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <Button variant="ghost" size="sm" onClick={() => router.push(`/websites/${siteId}`)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{siteName}</span>
            <span style={{ fontSize: 12, color: "#6b7280", textTransform: "capitalize" }}>{status}</span>
          </div>
          {pages.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {pages.map((p) => (
                <button
                  key={p.path}
                  type="button"
                  onClick={() => setActivePath(p.path)}
                  style={{
                    fontSize: 13,
                    padding: "5px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border, #e5e7eb)",
                    background: p.path === activePath ? "#111827" : "transparent",
                    color: p.path === activePath ? "#fff" : "#374151",
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {liveUrl && (
              <a href={liveUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
                View site <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <Button variant="brand" size="sm" onClick={publishChanges} disabled={saving}>
              {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</>) : saved ? (<><Check className="h-4 w-4" /> Published</>) : "Publish changes"}
            </Button>
          </div>
        </div>
        {error && <div style={{ background: "#fef2f2", color: "#991b1b", fontSize: 13, padding: "8px 16px" }}>{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", flex: 1, minHeight: 0 }}>
          <div style={{ minWidth: 0, overflow: "auto" }}><Puck.Preview /></div>
          <div style={{ borderLeft: "1px solid var(--border, #e5e7eb)", overflow: "auto" }}><Puck.Fields /></div>
        </div>
      </div>
    </Puck>
  )
}
