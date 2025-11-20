"use client"

import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import KeywordForm from "@/components/keywords/keyword-form"
import { KeywordService } from "@/services/keyword-service"
import { toast } from "sonner"

export default function NewKeywordPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const handleSubmit = async (data: { keyword: string }) => {
    try {
      await KeywordService.addKeyword(data)
      queryClient.invalidateQueries({ queryKey: ["keywords"] })
      toast.success("Keyword added")
      router.push("/settings/keywords")
    } catch (err) {
      console.error("Failed to add keyword", err)
      toast.error("Failed to add keyword")
    }
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Add Keyword</h1>
      <KeywordForm onSubmit={handleSubmit} />
    </div>
  )
}
