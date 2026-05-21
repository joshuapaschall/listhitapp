"use client"

import { useEffect, useRef, useState } from "react"
import { init, type TemplaticalEditor as TemplaticalEditorInstance } from "@templatical/editor"
import mjml2html from "mjml"
import { supabaseBrowser } from "@/lib/supabase-browser"

const SPIKE_MERGE_TAGS = [
  { label: "First name", value: "{{first_name}}" },
  { label: "Last name", value: "{{last_name}}" },
  { label: "Phone", value: "{{phone}}" },
  { label: "Email", value: "{{email}}" },
  { label: "Contact form link", value: "{{contact_form_link}}" },
  { label: "My first name", value: "{{my_first_name}}" },
  { label: "My last name", value: "{{my_last_name}}" },
]

const SAMPLE_BUYER = {
  fname: "Jordan",
  lname: "Rivera",
  phone: "555-0100",
  email: "jordan@example.com",
}

function renderTemplate(input: string): string {
  return input
    .replaceAll("{{first_name}}", SAMPLE_BUYER.fname)
    .replaceAll("{{last_name}}", SAMPLE_BUYER.lname)
    .replaceAll("{{phone}}", SAMPLE_BUYER.phone)
    .replaceAll("{{email}}", SAMPLE_BUYER.email)
    .replaceAll("{{contact_form_link}}", "https://example.com/contact")
    .replaceAll("{{my_first_name}}", "ListHit")
    .replaceAll("{{my_last_name}}", "Team")
}

type SpikeMediaResult = { url: string; alt?: string }

async function openSpikeUpload(): Promise<SpikeMediaResult | null> {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = "image/*"

  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })

  if (!file) return null

  const signRes = await fetch("/api/_spike/templatical-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
  })

  if (!signRes.ok) {
    throw new Error("Failed to sign upload URL")
  }

  const { path, token, publicUrl } = (await signRes.json()) as {
    path: string
    token: string
    publicUrl: string
  }

  const { error } = await supabaseBrowser().storage
    .from("email-assets")
    .uploadToSignedUrl(path, token, file, { contentType: file.type })

  if (error) {
    throw new Error(error.message)
  }

  return { url: publicUrl, alt: "" }
}

export default function TemplaticalEditor({
  onRendered,
}: {
  onRendered: (mjml: string, html: string) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<TemplaticalEditorInstance | null>(null)
  const [isRendering, setIsRendering] = useState(false)

  useEffect(() => {
    let mounted = true

    async function mountEditor() {
      if (!containerRef.current) return

      const editor = await init({
        container: containerRef.current,
        mergeTags: { syntax: "handlebars", tags: SPIKE_MERGE_TAGS },
        lint: { accessibility: {}, structure: {}, links: {} },
        async onRequestMedia() {
          return await openSpikeUpload()
        },
      })

      if (!mounted) {
        editor.unmount()
        return
      }

      editorRef.current = editor
    }

    mountEditor()

    return () => {
      mounted = false
      editorRef.current?.unmount()
      editorRef.current = null
    }
  }, [])

  async function handleRender() {
    if (!editorRef.current) return
    setIsRendering(true)
    try {
      const nextMjml = await editorRef.current.toMjml()
      let compiled = ""

      try {
        compiled = (await mjml2html(nextMjml)).html
      } catch {
        const res = await fetch("/api/_spike/templatical-render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mjml: nextMjml }),
        })
        if (!res.ok) {
          throw new Error("Server render failed")
        }
        const body = (await res.json()) as { html: string }
        compiled = body.html
      }

      const renderedHtml = renderTemplate(compiled)
      onRendered(nextMjml, renderedHtml)
    } finally {
      setIsRendering(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-2">
        <button
          type="button"
          onClick={handleRender}
          disabled={isRendering}
          className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
        >
          {isRendering ? "Rendering..." : "Render"}
        </button>
      </div>
      <div ref={containerRef} className="h-full" />
    </div>
  )
}
