"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import TemplateForm from "@/components/templates/template-form"
import { TemplateService } from "@/services/template-service"
import { toast } from "sonner"
import type { TemplateSlug } from "../template-types"
import { templateTypeConfig } from "../template-types"

interface TemplateEditorProps {
  slug: TemplateSlug
  mode: "new" | "edit"
  id?: string
}

export default function TemplateEditor({ slug, mode, id }: TemplateEditorProps) {
  const config = templateTypeConfig[slug]
  const router = useRouter()
  const queryClient = useQueryClient()
  const [initial, setInitial] = useState<{ name: string; message: string } | null>(null)
  const [loading, setLoading] = useState(mode === "edit")

  useEffect(() => {
    if (mode !== "edit" || !id) return
    TemplateService.getTemplate(id, config.type)
      .then((t) => {
        if (t) setInitial({ name: t.name, message: t.message })
      })
      .finally(() => setLoading(false))
  }, [config.type, id, mode])

  const handleSubmit = async (data: { name: string; message: string }) => {
    try {
      if (mode === "new") {
        await TemplateService.addTemplate(data, config.type)
        toast.success("Template created")
      } else if (id) {
        await TemplateService.updateTemplate(id, data, config.type)
        toast.success("Template updated")
      }
      queryClient.invalidateQueries({ queryKey: ["templates", config.type] })
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

  return (
    <div className="p-4 max-w-xl mx-auto space-y-1">
      <h1 className="text-2xl font-bold">
        {mode === "new" ? `New ${config.singular}` : "Edit Template"}
      </h1>
      <p className="text-sm text-muted-foreground">{config.description}</p>
      <TemplateForm channel={config.type} initial={initial ?? undefined} onSubmit={handleSubmit} />
    </div>
  )
}
