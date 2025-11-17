"use client"

import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import PromptForm from "@/components/prompts/prompt-form"
import { PromptService } from "@/services/prompt-service"
import { toast } from "sonner"

export default function NewPromptPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const handleSubmit = async (data: { name: string; description: string; prompt: string }) => {
    try {
      await PromptService.addPrompt(data)
      queryClient.invalidateQueries({ queryKey: ["prompts"] })
      toast.success("Prompt created")
      router.push("/prompts")
    } catch (err) {
      console.error("Failed to create prompt", err)
      toast.error("Failed to create prompt")
    }
  }

  return (
    <MainLayout>
      <div className="p-4 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">New Prompt</h1>
        <PromptForm onSubmit={handleSubmit} />
      </div>
    </MainLayout>
  )
}
