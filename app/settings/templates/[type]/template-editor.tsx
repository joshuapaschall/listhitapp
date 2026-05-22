"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import TemplateForm from "@/components/templates/template-form"
import EmailTemplateBuilder from "@/components/templates/email-template-builder"
import type { TemplateContent } from "@templatical/editor"
import { TemplateService } from "@/services/template-service"
import { toast } from "sonner"
import type { TemplateSlug } from "../template-types"
import { templateTypeConfig } from "../template-types"

interface TemplateEditorProps {
  slug: TemplateSlug
  mode: "new" | "edit"
  id?: string
}

interface TemplateInitialData {
  name: string
  message: string
  design_json?: TemplateContent | null
}

export default function TemplateEditor({ slug, mode, id }: TemplateEditorProps) {
  const config = templateTypeConfig[slug]
  const isEmail = config.type === "email"
  const router = useRouter()
  const queryClient = useQueryClient()

  const [initial, setInitial] = useState<TemplateInitialData | null>(null)
  const [loading, setLoading] = useState(mode === "edit")

  useEffect(() => {
    if (mode !== "edit" || !id) return
    TemplateService.getTemplate(id, config.type)
      .then((t) => {
        if (t) {
          setInitial({
            name: t.name,
            message: t.message,
            design_json: (t.design_json as TemplateContent | null) ?? null,
          })
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

  if (mode === "edit" && loading) {
    return <div className="p-4">Loading...</div>
  }
  if (mode === "edit" && !initial) {
    return <div className="p-4">Template not found.</div>
  }

  if (isEmail) {
    return (
      <EmailTemplateBuilder
        slug={slug}
        mode={mode}
        id={id}
        initialName={initial?.name ?? ""}
        initialDesign={initial?.design_json ?? null}
      />
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">{mode === "new" ? `New ${config.singular}` : "Edit Template"}</h1>
      <p className="text-sm text-muted-foreground">{config.description}</p>
      <TemplateForm
        channel={config.type}
        initial={initial ? { name: initial.name, message: initial.message } : undefined}
        onSubmit={handleTextTemplateSubmit}
      />
    </div>
  )
}
