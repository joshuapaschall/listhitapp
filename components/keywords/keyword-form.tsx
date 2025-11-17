"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface KeywordFormProps {
  initial?: { keyword: string }
  onSubmit: (data: { keyword: string }) => Promise<void>
}

export default function KeywordForm({ initial, onSubmit }: KeywordFormProps) {
  const [keyword, setKeyword] = useState(initial?.keyword || "")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyword.trim()) return
    setLoading(true)
    try {
      await onSubmit({ keyword })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="keyword" className="block text-sm font-medium mb-1">Keyword</label>
        <Input id="keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        {!keyword.trim() && (
          <p className="text-xs text-red-600">Keyword is required</p>
        )}
      </div>
      <Button type="submit" disabled={!keyword.trim() || loading}>
        {loading ? "Saving..." : "Save"}
      </Button>
    </form>
  )
}
