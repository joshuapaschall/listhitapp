"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"

const TemplaticalEditor = dynamic(
  () => import("@/components/campaigns/_spike/templatical-editor"),
  { ssr: false },
)

export default function TemplaticalSpikePage() {
  const [mjml, setMjml] = useState("")
  const [html, setHtml] = useState("")
  const [activeTab, setActiveTab] = useState<"mjml" | "html">("mjml")

  const iframeSrcDoc = useMemo(() => html || "<html><body></body></html>", [html])

  return (
    <main className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Templatical Editor Spike</h1>
      <div className="grid h-[calc(100vh-8rem)] grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-h-0 overflow-hidden rounded-md border">
          <TemplaticalEditor onRendered={(nextMjml, nextHtml) => {
            setMjml(nextMjml)
            setHtml(nextHtml)
          }} />
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border">
          <div className="flex border-b">
            <button
              type="button"
              className={`px-4 py-2 text-sm ${activeTab === "mjml" ? "bg-muted font-medium" : ""}`}
              onClick={() => setActiveTab("mjml")}
            >
              MJML
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm ${activeTab === "html" ? "bg-muted font-medium" : ""}`}
              onClick={() => setActiveTab("html")}
            >
              HTML
            </button>
          </div>

          {activeTab === "mjml" ? (
            <pre className="h-full overflow-auto p-4 text-xs">{mjml || "Render to see MJML output"}</pre>
          ) : (
            <iframe title="Spike HTML Preview" className="h-full w-full" srcDoc={iframeSrcDoc} />
          )}
        </div>
      </div>
    </main>
  )
}
