"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { Showing } from "@/lib/supabase"
import { ShowingService } from "@/services/showing-service"
import { toast } from "sonner"

interface DeleteShowingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  showing: Showing | null
  onSuccess?: () => void
}

export default function DeleteShowingModal({ open, onOpenChange, showing, onSuccess }: DeleteShowingModalProps) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!showing) return
    setLoading(true)
    try {
      await ShowingService.deleteShowing(showing.id)
      toast.success("Showing deleted")
      if (onSuccess) onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error("Error deleting showing:", err)
      toast.error("Failed to delete showing")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Showing</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. Are you sure you want to delete this showing?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={loading}>Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
