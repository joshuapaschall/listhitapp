"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface KeywordFormValues {
  keyword: string
  matchType: "exact" | "phrase"
  action: "hide" | "dnc"
}

interface KeywordFormProps {
  initial?: Partial<KeywordFormValues>
  onSubmit: (data: KeywordFormValues) => Promise<void>
}

export default function KeywordForm({ initial, onSubmit }: KeywordFormProps) {
  const [keyword, setKeyword] = useState(initial?.keyword || "")
  const [matchType, setMatchType] = useState<"exact" | "phrase">(initial?.matchType || "phrase")
  const [action, setAction] = useState<"hide" | "dnc">(initial?.action || "hide")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyword.trim()) return
    setLoading(true)
    try {
      await onSubmit({ keyword: keyword.trim(), matchType, action })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="keyword">Keyword</Label>
        <Input id="keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. not interested" />
        {!keyword.trim() && <p className="text-xs text-destructive">Keyword is required</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Match type</Label>
          <Select value={matchType} onValueChange={(v) => setMatchType(v as "exact" | "phrase")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="phrase">Phrase (contains)</SelectItem>
              <SelectItem value="exact">Exact (whole message)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {matchType === "exact"
              ? "Fires only when the whole reply equals the keyword."
              : "Fires when the reply contains the keyword anywhere."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>On match</Label>
          <Select value={action} onValueChange={(v) => setAction(v as "hide" | "dnc")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hide">Hide only</SelectItem>
              <SelectItem value="dnc">DNC + hide</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {action === "dnc"
              ? "Hides the reply and stops future SMS sends to them."
              : "Tucks the reply into the Filtered tab; returns if they message again."}
          </p>
        </div>
      </div>

      <Button type="submit" disabled={!keyword.trim() || loading}>
        {loading ? "Saving..." : "Save"}
      </Button>
    </form>
  )
}
