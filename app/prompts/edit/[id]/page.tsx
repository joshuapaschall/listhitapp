"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import PromptForm from "@/components/prompts/prompt-form"
import { PromptService } from "@/services/prompt-service"
import { toast } from "sonner"

export default function EditPromptPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.id as string

  const [initial, setInitial] = useState<{
    name: string
    description: string | null
    prompt: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    PromptService.getPrompt(id)
      .then((p) => {
        if (p) setInitial({ name: p.name, description: p.description, prompt: p.prompt })
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (data: { name: string; description: string; prompt: string }) => {
    try {
      await PromptService.updatePrompt(id, data)
      queryClient.invalidateQueries({ queryKey: ["prompts"] })
      toast.success("Prompt updated")
      router.push("/prompts")
    } catch (err) {
      console.error("Failed to update prompt", err)
      toast.error("Failed to update prompt")
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
        <div className="p-4">Prompt not found.</div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-4 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Edit Prompt</h1>
        <PromptForm initial={initial} onSubmit={handleSubmit} />
      </div>
    </MainLayout>
  )
}
