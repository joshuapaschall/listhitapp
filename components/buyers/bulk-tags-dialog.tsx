"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import TagSelector from "./tag-selector"

interface BulkTagsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "add" | "remove"
  onSubmit: (tags: string[]) => void
  availableTags?: { tag: string; count: number }[]
  loadingTags?: boolean
}

export default function BulkTagsDialog({
  open,
  onOpenChange,
  mode,
  onSubmit,
  availableTags = [],
  loadingTags = false,
}: BulkTagsDialogProps) {
  const [tags, setTags] = useState<string[]>([])

  const handleSubmit = () => {
    if (tags.length === 0) return
    onSubmit(tags)
    setTags([])
    onOpenChange(false)
  }

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
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
          {mode === "add" ? (
            <TagSelector value={tags} onChange={setTags} allowCreate />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Only the tags you select are removed. All other tags stay.
              </p>
              {loadingTags ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading tags…
                </div>
              ) : availableTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">These buyers have no tags to remove.</p>
              ) : (
                <div className="max-h-64 overflow-auto rounded-md border border-border">
                  {availableTags.map(({ tag, count }) => {
                    const selected = tags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-0",
                          selected ? "bg-brand/10 text-foreground" : "hover:bg-muted/60",
                        )}
                        aria-pressed={selected}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              selected ? "text-brand" : "text-transparent",
                            )}
                          />
                          <span className="truncate">{tag}</span>
                        </span>
                        <Badge variant="secondary" className="shrink-0 text-xs text-muted-foreground">
                          {count}
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
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
