"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import KeywordForm from "@/components/keywords/keyword-form"
import { KeywordService } from "@/services/keyword-service"
import { toast } from "sonner"

export default function EditKeywordPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.id as string

  const [initial, setInitial] = useState<{ keyword: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    KeywordService.getKeyword(id)
      .then((k) => {
        if (k) setInitial({ keyword: k.keyword })
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (data: { keyword: string }) => {
    try {
      await KeywordService.updateKeyword(id, data)
      queryClient.invalidateQueries({ queryKey: ["keywords"] })
      toast.success("Keyword updated")
      router.push("/settings/keywords")
    } catch (err) {
      console.error("Failed to update keyword", err)
      toast.error("Failed to update keyword")
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  if (!initial) {
    return <div className="p-4">Keyword not found.</div>
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Edit Keyword</h1>
      <KeywordForm initial={initial} onSubmit={handleSubmit} />
    </div>
  )
}
