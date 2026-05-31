"use client"

import { type MouseEvent, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  actionText?: string
  cancelText?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  actionText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async (e: MouseEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onConfirm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed")
    } finally {
      setSubmitting(false)
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={submitting}>
              {cancelText}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant={destructive ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? `${actionText}…` : actionText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
