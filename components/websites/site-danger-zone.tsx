"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

// Uses ONLY existing endpoints: POST /api/sites/[id]/publish ({unpublish:true})
// and DELETE /api/sites/[id]. No new API routes.
export function SiteDangerZone({ siteId, published }: { siteId: string; published: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<"unpublish" | "delete" | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function unpublish() {
    setBusy("unpublish")
    try {
      const res = await fetch(`/api/sites/${siteId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unpublish: true }),
      })
      if (!res.ok) throw new Error()
      toast.success("Website unpublished")
      router.refresh()
    } catch {
      toast.error("Couldn't unpublish the website")
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy("delete")
    try {
      const res = await fetch(`/api/sites/${siteId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Website deleted")
      router.push("/websites")
    } catch {
      toast.error("Couldn't delete the website")
      setBusy(null)
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-4">
      {published && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Unpublish website</p>
            <p className="text-xs text-muted-foreground">Take the site offline. You can republish anytime.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={unpublish} disabled={busy !== null}>
            {busy === "unpublish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            Unpublish
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <div>
          <p className="text-sm font-medium text-destructive">Delete website</p>
          <p className="text-xs text-muted-foreground">Permanently removes this site and its pages. This can&apos;t be undone.</p>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={busy !== null}>
              {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Confirm delete
            </Button>
          </div>
        ) : (
          <Button type="button" variant="destructive" size="sm" onClick={() => setConfirming(true)} disabled={busy !== null}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
      </div>
    </div>
  )
}
