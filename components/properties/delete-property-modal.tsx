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
import type { Property } from "@/lib/supabase"
import { PropertyService } from "@/services/property-service"
import { toast } from "sonner"

interface DeletePropertyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  property: Property | null
  onSuccess?: () => void
}

export default function DeletePropertyModal({
  open,
  onOpenChange,
  property,
  onSuccess,
}: DeletePropertyModalProps) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!property) return
    setLoading(true)
    try {
      await PropertyService.deleteProperty(property.id)
      toast.success("Property deleted")
      if (onSuccess) onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error("Error deleting property:", err)
      toast.error("Failed to delete property")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Property</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. Are you sure you want to delete this property?
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
