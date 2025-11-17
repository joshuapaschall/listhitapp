"use client"

import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import TemplateForm from "@/components/templates/template-form"
import { TemplateService } from "@/services/template-service"
import { toast } from "sonner"

export default function NewTemplatePage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const handleSubmit = async (data: { name: string; message: string }) => {
    try {
      const template = await TemplateService.addTemplate(data)
      queryClient.invalidateQueries({ queryKey: ["templates"] })
      toast.success("Template created")
      router.push("/templates")
    } catch (err) {
      console.error("Failed to create template", err)
      toast.error("Failed to create template")
    }
  }

  return (
    <MainLayout>
      <div className="p-4 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">New Template</h1>
        <TemplateForm channel="sms" onSubmit={handleSubmit} />
      </div>
    </MainLayout>
  )
}
