"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

interface PromptFormProps {
  initial?: { name: string; description: string | null; prompt: string }
  onSubmit: (data: { name: string; description: string; prompt: string }) => Promise<void>
}

export default function PromptForm({ initial, onSubmit }: PromptFormProps) {
  const [name, setName] = useState(initial?.name || "")
  const [description, setDescription] = useState(initial?.description || "")
  const [prompt, setPrompt] = useState(initial?.prompt || "")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !prompt.trim()) return
    setLoading(true)
    try {
      await onSubmit({ name, description, prompt })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="prompt-name" className="block text-sm font-medium mb-1">
          Name
        </label>
        <Input id="prompt-name" value={name} onChange={(e) => setName(e.target.value)} />
        {!name.trim() && <p className="text-xs text-red-600">Name is required</p>}
      </div>
      <div>
        <label htmlFor="prompt-description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <Input
          id="prompt-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="prompt-text" className="block text-sm font-medium mb-1">
          Prompt
        </label>
        <Textarea
          id="prompt-text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
        />
        {!prompt.trim() && <p className="text-xs text-red-600">Prompt is required</p>}
      </div>
      <Button type="submit" disabled={loading || !name.trim() || !prompt.trim()}>
        {loading ? "Saving..." : "Save"}
      </Button>
    </form>
  )
}
