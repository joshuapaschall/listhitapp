"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import GroupTreeSelector from "./group-tree-selector"

interface BulkGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "add" | "remove" | "move"
  onSubmit: (groupIds: string[]) => void
}

export default function BulkGroupDialog({ open, onOpenChange, mode, onSubmit }: BulkGroupDialogProps) {
  const [groupIds, setGroupIds] = useState<string[]>([])

  const handleSubmit = () => {
    if (groupIds.length === 0) return
    onSubmit(groupIds)
    setGroupIds([])
    onOpenChange(false)
  }

  const title =
    mode === "add"
      ? "Add to Groups"
      : mode === "remove"
        ? "Remove from Groups"
        : "Move to Groups"
  const actionLabel = title

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-2 max-h-64 overflow-y-auto">
          <GroupTreeSelector value={groupIds} onChange={setGroupIds} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={groupIds.length === 0}>
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

