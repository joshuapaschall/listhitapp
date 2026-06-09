"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export function DealVisibilityCard({
  siteId,
  initialPublic,
}: {
  siteId: string
  initialPublic: boolean
}) {
  const [pub, setPub] = useState(initialPublic)
  const [busy, setBusy] = useState(false)

  async function toggle(next: boolean) {
    setPub(next)
    setBusy(true)
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deals_public: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPub(!next)
        toast.error(json?.error || "Couldn't update deal visibility.")
      } else {
        toast.success(next ? "Deals are now public." : "Deals now require an email to view.")
      }
    } catch {
      setPub(!next)
      toast.error("Couldn't update deal visibility.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-1 text-sm font-semibold">Deal visibility</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Choose what visitors see on your public properties page.
      </p>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor="deals-public" className="text-sm font-medium">
            Show deals publicly
          </Label>
          <p className="mt-1 text-sm text-muted-foreground">
            {pub
              ? "Anyone can browse your full deal list and open each listing."
              : "Visitors must enter their email to unlock deals (lead-capture funnel)."}
          </p>
        </div>
        <Switch id="deals-public" checked={pub} disabled={busy} onCheckedChange={toggle} />
      </div>
    </Card>
  )
}
