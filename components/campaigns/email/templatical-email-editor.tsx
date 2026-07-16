"use client"

import { useEffect, useRef } from "react"
import { init, type TemplateContent, type TemplaticalEditor, type ThemeOverrides } from "@templatical/editor"
import { toast } from "sonner"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { EMAIL_CUSTOM_FONTS, EMAIL_DEFAULT_FALLBACK, EMAIL_DEFAULT_FONT } from "@/lib/email-templates/email-fonts"

export type { TemplaticalEditor } from "@templatical/editor"

interface TemplaticalEmailEditorProps {
  initialContent?: TemplateContent | null
  onChange?: (content: TemplateContent) => void
  onReady?: (editor: TemplaticalEditor) => void
}

type UploadMediaResponse = { url: string; alt?: string }

const theme: ThemeOverrides = {
  primary: "#F0303A",
  primaryHover: "#D0202A",
  primaryLight: "#ECFDF5",
  canvasBg: "#F9FAFB",
}

async function pickImageFile(): Promise<File | null> {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = "image/*"
  input.style.display = "none"
  document.body.appendChild(input)

  try {
    return await new Promise<File | null>((resolve) => {
      input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true })
      input.addEventListener("cancel", () => resolve(null), { once: true })
      input.click()
    })
  } finally {
    input.remove()
  }
}

async function openImageUpload(): Promise<UploadMediaResponse | null> {
  try {
    const file = await pickImageFile()
    if (!file) return null

    const signRes = await fetch("/api/campaigns/email/upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
    })

    if (!signRes.ok) {
      const body = (await signRes.json().catch(() => ({}))) as { error?: string; details?: string }
      const detail = body.details || body.error || `HTTP ${signRes.status}`
      toast.error(`Couldn't prepare the upload: ${detail}`)
      console.error("[email-upload-image] sign request failed", { status: signRes.status, body })
      return null
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
      toast.error(`Image upload failed: ${error.message}`)
      console.error("[email-upload-image] upload failed", error)
      return null
    }

    toast.success("Image uploaded")
    return { url: publicUrl, alt: "" }
  } catch (err) {
    toast.error("Image upload failed. Check your connection and try again.")
    console.error("[email-upload-image] unexpected error", err)
    return null
  }
}

export default function TemplaticalEmailEditor({ initialContent, onChange, onReady }: TemplaticalEmailEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onChangeRef = useRef(onChange)
  const onReadyRef = useRef(onReady)
  const openImageUploadRef = useRef(openImageUpload)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

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
      fonts: {
        defaultFont: EMAIL_DEFAULT_FONT,
        defaultFallback: EMAIL_DEFAULT_FALLBACK,
        customFonts: EMAIL_CUSTOM_FONTS,
      },
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
      branding: false,
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
        onReadyRef.current?.(editor)
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
    }
  }, [])

  return <div ref={containerRef} className="h-full min-h-[600px]" />
}
