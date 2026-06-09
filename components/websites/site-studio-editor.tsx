"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Puck, type Data } from "@measured/puck"
import "@measured/puck/puck.css"
import { siteConfig } from "@/lib/site-builder/blocks/config"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, Check, ExternalLink } from "lucide-react"

export function SiteStudioEditor({
  siteId, slug, siteName, status, initialData,
}: {
  siteId: string; slug: string; siteName: string; status: string; initialData: Data
}) {
  const router = useRouter()
  const dataRef = useRef<Data>(initialData)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const liveUrl = slug ? `https://${slug}.listhit.io` : ""

  async function publishChanges() {
    setSaving(true); setError(""); setSaved(false)
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageData: { path: "/", data: dataRef.current } }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to save")
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
      data={initialData}
      onChange={(d: Data) => { dataRef.current = d }}
      permissions={{ insert: false }}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--border, #e5e7eb)", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <Button variant="ghost" size="sm" onClick={() => router.push(`/websites/${siteId}`)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{siteName}</span>
            <span style={{ fontSize: 12, color: "#6b7280", textTransform: "capitalize" }}>{status}</span>
          </div>
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
