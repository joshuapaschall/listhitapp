"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import { init, type TemplateContent, type TemplaticalEditor, type ThemeOverrides } from "@templatical/editor"
import { supabaseBrowser } from "@/lib/supabase-browser"

interface TemplaticalEmailEditorProps {
  initialContent?: TemplateContent | null
  onChange?: (content: TemplateContent) => void
}

export interface TemplaticalEmailEditorHandle {
  getContent: () => TemplateContent | null
  toMjml: () => Promise<string>
  isReady: () => boolean
}

type UploadMediaResponse = { url: string; alt?: string }

const theme: ThemeOverrides = {
  primary: "#059669",
  primaryHover: "#047857",
  primaryLight: "#ECFDF5",
  canvasBg: "#F9FAFB",
}

async function openImageUpload(): Promise<UploadMediaResponse | null> {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = "image/*"

  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })

  if (!file) return null

  const signRes = await fetch("/api/campaigns/email/upload-image", {
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

const TemplaticalEmailEditor = forwardRef<TemplaticalEmailEditorHandle, TemplaticalEmailEditorProps>(
  function TemplaticalEmailEditor({ initialContent, onChange }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const editorRef = useRef<TemplaticalEditor | null>(null)
    const onChangeRef = useRef(onChange)
    const openImageUploadRef = useRef(openImageUpload)

    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
      const mountPoint = containerRef.current
      if (!mountPoint) return

      const host = document.createElement("div")
      host.style.height = "100%"
      host.style.width = "100%"
      mountPoint.appendChild(host)

      let cancelled = false
      let instance: TemplaticalEditor | null = null

      init({
        container: host,
        content: initialContent ?? undefined,
        uiTheme: "light",
        theme,
        mergeTags: {
          syntax: "handlebars",
          tags: [
            { label: "First name", value: "{{first_name}}" },
            { label: "Last name", value: "{{last_name}}" },
            { label: "Phone", value: "{{phone}}" },
            { label: "Email", value: "{{email}}" },
          ],
        },
        lint: { accessibility: {}, structure: {}, links: {} },
        onChange: (content) => onChangeRef.current?.(content),
        async onRequestMedia() {
          return await openImageUploadRef.current()
        },
      })
        .then((editor) => {
          if (cancelled) {
            editor.unmount()
            host.remove()
            return
          }
          instance = editor
          editorRef.current = editor
        })
        .catch((err) => {
          if (!cancelled) {
            console.error("Templatical init failed", err)
          }
        })

      return () => {
        cancelled = true
        instance?.unmount()
        host.remove()
        editorRef.current = null
      }
    }, [])

    useImperativeHandle(ref, () => ({
      isReady: () => editorRef.current !== null,
      getContent: () => editorRef.current?.getContent() ?? null,
      toMjml: async () => {
        if (!editorRef.current) return ""
        return editorRef.current.toMjml()
      },
    }), [])

    return <div ref={containerRef} className="h-full min-h-[600px]" />
  },
)

export default TemplaticalEmailEditor
