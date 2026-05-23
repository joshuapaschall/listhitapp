"use client"

import { useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import EmailTemplatePicker, { type EmailPickResult } from "@/components/campaigns/email/email-template-picker"
import type { TemplaticalEmailEditorHandle } from "@/components/campaigns/email/templatical-email-editor"
import type { TemplateContent } from "@templatical/editor"
import { createDefaultTemplateContent, createHtmlBlock } from "@templatical/types"
import { emptyEmailTemplate } from "@/lib/email-templates"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TemplateService } from "@/services/template-service"
import type { TemplateSlug } from "@/app/settings/templates/template-types"

const TemplaticalEmailEditor = dynamic(() => import("@/components/campaigns/email/templatical-email-editor"), {
  ssr: false,
})

interface Props {
  slug: TemplateSlug
  mode: "new" | "edit"
  id?: string
  initialName?: string
  initialDesign?: TemplateContent | null
}

export default function EmailTemplateBuilder({ slug, mode, id, initialName = "", initialDesign = null }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const editorRef = useRef<TemplaticalEmailEditorHandle>(null)

  const hasInitialDesign = !!initialDesign && Array.isArray(initialDesign.blocks) && initialDesign.blocks.length > 0

  const [name, setName] = useState(initialName)
  const [builderStep, setBuilderStep] = useState<"picker" | "editor">(hasInitialDesign ? "editor" : "picker")
  const [pickerBucket, setPickerBucket] = useState<"basic" | "fully-designed" | undefined>(undefined)
  const [pickerKey, setPickerKey] = useState(0)
  const [editorSeed, setEditorSeed] = useState<TemplateContent | null>(hasInitialDesign ? initialDesign : null)
  const [editorKey, setEditorKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [changeTemplateOpen, setChangeTemplateOpen] = useState(false)

  const back = () => router.push(`/settings/templates/${slug}`)

  const handlePick = (r: EmailPickResult) => {
    let content: TemplateContent
    if (r.kind === "scratch") {
      content = emptyEmailTemplate()
    } else if (r.kind === "html") {
      const c = createDefaultTemplateContent("Inter, Helvetica, Arial, sans-serif")
      c.blocks = [createHtmlBlock({ content: "<!-- Paste or write your HTML here -->" })]
      content = c
    } else if (r.kind === "saved") {
      content = r.record.design_json as TemplateContent
    } else {
      content = r.def.build()
    }
    setEditorSeed(content)
    setEditorKey((k) => k + 1)
    setBuilderStep("editor")
  }

  const handleSave = async () => {
    const editor = editorRef.current
    if (!editor?.isReady()) {
      toast.error("Editor not ready — try again in a moment")
      return
    }
    if (!name.trim()) {
      toast.error("Name is required")
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
      const payload = { name: name.trim(), message: html, design_json: design, mjml }
      if (mode === "new") {
        await TemplateService.addTemplate(payload, "email")
        toast.success("Template created")
      } else if (id) {
        await TemplateService.updateTemplate(id, payload, "email")
        toast.success("Template updated")
      }
      await queryClient.invalidateQueries({ queryKey: ["templates", "email"] })
      back()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {builderStep === "picker" ? (
        <div className="flex-1 overflow-auto px-6 py-8">
          <EmailTemplatePicker key={pickerKey} initialBucket={pickerBucket} onPick={handlePick} onClose={back} />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-border px-6 py-3">
            <Button variant="ghost" size="icon" onClick={back} aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Input
              className="max-w-sm"
              placeholder="Ex: Buyer blast v1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button variant="ghost" onClick={() => setChangeTemplateOpen(true)}>Change template</Button>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" onClick={back}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {saving ? "Saving…" : "Save & Close"}
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 p-4">
            <TemplaticalEmailEditor key={editorKey} ref={editorRef} initialContent={editorSeed} />
          </div>
        </>
      )}


      {changeTemplateOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Change template?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This replaces your current design with a different starting point. Unsaved changes in the current design will be lost.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setChangeTemplateOpen(false)}>Keep editing</Button>
              <Button
                className="bg-brand text-brand-fg hover:bg-brand-hover"
                onClick={() => {
                  setChangeTemplateOpen(false)
                  setPickerBucket("fully-designed")
                  setPickerKey((k) => k + 1)
                  setBuilderStep("picker")
                }}
              >
                Choose new template
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
