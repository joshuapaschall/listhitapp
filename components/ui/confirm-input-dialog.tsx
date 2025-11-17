"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface ConfirmInputDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmationText: string
  actionText?: string
  onConfirm: () => void | Promise<void>
}

export default function ConfirmInputDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmationText,
  actionText = "Confirm",
  onConfirm,
}: ConfirmInputDialogProps) {
  const [value, setValue] = useState("")
  const reset = () => setValue("")

  const handleOpenChange = (o: boolean) => {
    if (!o) reset()
    onOpenChange(o)
  }

  const handleConfirm = async () => {
    await onConfirm()
    reset()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <div className="space-y-2">
          <p className="text-sm">
            Please type <strong>{confirmationText}</strong> to continue.
          </p>
          <Input
            id="confirm-input"
            name="confirm-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={confirmationText}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline">Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={value !== confirmationText}
            >
              {actionText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
