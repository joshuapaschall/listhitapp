"use client"

import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import KeywordForm, { type KeywordFormValues } from "@/components/keywords/keyword-form"
import { KeywordService } from "@/services/keyword-service"
import { toast } from "sonner"

export default function NewKeywordPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const handleSubmit = async (data: KeywordFormValues) => {
    try {
      await KeywordService.addKeyword(data)
      queryClient.invalidateQueries({ queryKey: ["keywords"] })
      toast.success("Keyword added")
      router.push("/settings/keywords")
    } catch (err) {
      console.error("Failed to add keyword", err)
      toast.error(err instanceof Error ? err.message : "Failed to add keyword")
    }
  }

  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Add keyword</h1>
      <KeywordForm onSubmit={handleSubmit} />
    </div>
  )
}
