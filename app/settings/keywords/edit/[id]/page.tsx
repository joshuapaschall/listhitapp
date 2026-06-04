"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import KeywordForm, { type KeywordFormValues } from "@/components/keywords/keyword-form"
import { KeywordService } from "@/services/keyword-service"
import { toast } from "sonner"

export default function EditKeywordPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.id as string

  const [initial, setInitial] = useState<KeywordFormValues | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSystem, setIsSystem] = useState(false)

  useEffect(() => {
    KeywordService.getKeyword(id)
      .then((k) => {
        if (k) {
          setIsSystem(k.is_system === true)
          setInitial({
            keyword: k.keyword,
            matchType: k.match_type || "phrase",
            action: k.action || "hide",
          })
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (data: KeywordFormValues) => {
    try {
      await KeywordService.updateKeyword(id, data)
      queryClient.invalidateQueries({ queryKey: ["keywords"] })
      toast.success("Keyword updated")
      router.push("/settings/keywords")
    } catch (err) {
      console.error("Failed to update keyword", err)
      toast.error(err instanceof Error ? err.message : "Failed to update keyword")
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  if (!initial) {
    return <div className="p-4">Keyword not found.</div>
  }

  if (isSystem) {
    return (
      <div className="mx-auto max-w-xl p-4">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Edit keyword</h1>
        <p className="text-sm text-muted-foreground">This is a system keyword and can&apos;t be edited.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Edit keyword</h1>
      <KeywordForm initial={initial} onSubmit={handleSubmit} />
    </div>
  )
}
