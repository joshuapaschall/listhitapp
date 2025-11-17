"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertTriangle, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Buyer } from "@/lib/supabase"

interface DeleteBuyerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  buyers: Buyer[]
  onSuccess?: () => void
}

export default function DeleteBuyerModal({ open, onOpenChange, buyers, onSuccess }: DeleteBuyerModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const isMultiple = buyers.length > 1
  const buyerNames = buyers
    .map((b) => b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed")
    .join(", ")

  const handleDelete = async () => {
    setLoading(true)
    setError("")

    try {
      const buyerIds = buyers.map((b) => b.id)

      // Delete buyers in batches of 50
      const BATCH_SIZE = 50
      for (let i = 0; i < buyerIds.length; i += BATCH_SIZE) {
        const batch = buyerIds.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from("buyers").delete().in("id", batch)

        if (error) throw error
      }

      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error("Error deleting buyers:", err)
      setError(err.message || "Failed to delete buyers")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setError("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Delete {isMultiple ? "Buyers" : "Buyer"}
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. {isMultiple ? "These buyers" : "This buyer"} will be permanently removed from
            your database.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>You are about to delete:</strong>
              <div className="mt-2 p-2 bg-muted rounded text-sm">
                {isMultiple ? (
                  <div>
                    <strong>{buyers.length} buyers:</strong>
                    <div className="mt-1 max-h-32 overflow-y-auto">
                      {buyers.map((buyer, index) => (
                        <div key={buyer.id} className="truncate">
                          {index + 1}.{" "}
                          {buyer.full_name || `${buyer.fname || ""} ${buyer.lname || ""}`.trim() || "Unnamed"}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>{buyerNames}</div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete {isMultiple ? `${buyers.length} Buyers` : "Buyer"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
