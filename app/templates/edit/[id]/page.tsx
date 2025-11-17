"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import TemplateForm from "@/components/templates/template-form"
import { TemplateService } from "@/services/template-service"
import { toast } from "sonner"

export default function EditTemplatePage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.id as string

  const [initial, setInitial] = useState<{ name: string; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    TemplateService.getTemplate(id)
      .then((t) => {
        if (t) setInitial({ name: t.name, message: t.message })
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (data: { name: string; message: string }) => {
    try {
      await TemplateService.updateTemplate(id, data)
      queryClient.invalidateQueries({ queryKey: ["templates"] })
      toast.success("Template updated")
      router.push("/templates")
    } catch (err) {
      console.error("Failed to update template", err)
      toast.error("Failed to update template")
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-4">Loading...</div>
      </MainLayout>
    )
  }

  if (!initial) {
    return (
      <MainLayout>
        <div className="p-4">Template not found.</div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-4 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Edit Template</h1>
        <TemplateForm channel="sms" initial={initial} onSubmit={handleSubmit} />
      </div>
    </MainLayout>
  )
}
