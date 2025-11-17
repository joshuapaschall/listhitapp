"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import TagSelector from "./tag-selector"

interface BulkTagsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "add" | "remove"
  onSubmit: (tags: string[]) => void
}

export default function BulkTagsDialog({ open, onOpenChange, mode, onSubmit }: BulkTagsDialogProps) {
  const [tags, setTags] = useState<string[]>([])

  const handleSubmit = () => {
    if (tags.length === 0) return
    onSubmit(tags)
    setTags([])
    onOpenChange(false)
  }

  const title = mode === "add" ? "Add Tags" : "Remove Tags"
  const actionLabel = mode === "add" ? "Add Tags" : "Remove Tags"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <TagSelector value={tags} onChange={setTags} allowCreate={mode === "add"} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={tags.length === 0}>
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

