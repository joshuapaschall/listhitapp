"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import TemplateForm from "@/components/templates/template-form"
import type { TemplateContent } from "@templatical/editor"
import type { TemplaticalEmailEditorHandle } from "@/components/campaigns/email/templatical-email-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { TemplateService } from "@/services/template-service"
import { toast } from "sonner"
import type { TemplateSlug } from "../template-types"
import { templateTypeConfig } from "../template-types"

const TemplaticalEmailEditor = dynamic(() => import("@/components/campaigns/email/templatical-email-editor"), {
  ssr: false,
})

interface TemplateEditorProps {
  slug: TemplateSlug
  mode: "new" | "edit"
  id?: string
}

interface TemplateInitialData {
  name: string
  subject: string
  message: string
  design_json?: TemplateContent | null
}

export default function TemplateEditor({ slug, mode, id }: TemplateEditorProps) {
  const config = templateTypeConfig[slug]
  const isEmail = config.type === "email"
  const router = useRouter()
  const queryClient = useQueryClient()
  const editorRef = useRef<TemplaticalEmailEditorHandle>(null)

  const [initial, setInitial] = useState<TemplateInitialData | null>(null)
  const [loading, setLoading] = useState(mode === "edit")
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")

  useEffect(() => {
    if (mode !== "edit" || !id) return
    TemplateService.getTemplate(id, config.type)
      .then((t) => {
        if (t) {
          setInitial({
            name: t.name,
            subject: t.subject ?? "",
            message: t.message,
            design_json: (t.design_json as TemplateContent | null) ?? null,
          })
          setName(t.name)
          setSubject(t.subject ?? "")
        }
      })
      .finally(() => setLoading(false))
  }, [config.type, id, mode])

  const handleTextTemplateSubmit = async (data: { name: string; message: string }) => {
    try {
      if (mode === "new") {
        await TemplateService.addTemplate(data, config.type)
        toast.success("Template created")
      } else if (id) {
        await TemplateService.updateTemplate(id, data, config.type)
        toast.success("Template updated")
      }
      await queryClient.invalidateQueries({ queryKey: ["templates", config.type] })
      router.push(`/settings/templates/${slug}`)
    } catch (err) {
      console.error("Failed to save template", err)
      toast.error("Failed to save template")
    }
  }

  const handleEmailSave = async () => {
    const editor = editorRef.current
    if (!editor?.isReady()) {
      toast.error("Editor not ready — try again in a moment")
      return
    }
    if (!name.trim() || !subject.trim()) {
      toast.error("Name and subject are required")
      return
    }

    setSaving(true)
    try {
      const design = editor.getContent()
      const mjml = await editor.toMjml()

      if (!design || !mjml.trim()) {
        toast.error("Nothing to save yet — add content first")
        return
      }

      const renderRes = await fetch("/api/campaigns/email/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mjml }),
      })

      if (!renderRes.ok) {
        const body = await renderRes.json().catch(() => ({}))
        throw new Error(body?.error || "Failed to render email")
      }

      const { html } = await renderRes.json()
      const payload = { name: name.trim(), subject: subject.trim(), message: html, design_json: design, mjml }

      if (mode === "new") {
        await TemplateService.addTemplate(payload, config.type)
        toast.success("Template created")
      } else if (id) {
        await TemplateService.updateTemplate(id, payload, config.type)
        toast.success("Template updated")
      }

      await queryClient.invalidateQueries({ queryKey: ["templates", config.type] })
      router.push(`/settings/templates/${slug}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save template"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (mode === "edit" && loading) {
    return <div className="p-4">Loading...</div>
  }

  if (mode === "edit" && !initial) {
    return <div className="p-4">Template not found.</div>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">
        {mode === "new" ? `New ${config.singular}` : "Edit Template"}
      </h1>
      <p className="text-sm text-muted-foreground">{config.description}</p>

      {isEmail ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <p className="text-sm font-medium">Template details</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="email-template-name" className="text-sm font-medium">Name</label>
                <Input
                  id="email-template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Buyer blast v1"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="email-template-subject" className="text-sm font-medium">Subject</label>
                <Input
                  id="email-template-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="New off-market opportunities"
                />
              </div>
            </CardContent>
          </Card>

          <div className="rounded-xl border bg-card p-3">
            <TemplaticalEmailEditor ref={editorRef} initialContent={initial?.design_json ?? null} />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleEmailSave} disabled={saving || !name.trim() || !subject.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <TemplateForm channel={config.type} initial={initial ? { name: initial.name, message: initial.message } : undefined} onSubmit={handleTextTemplateSubmit} />
      )}
    </div>
  )
}
