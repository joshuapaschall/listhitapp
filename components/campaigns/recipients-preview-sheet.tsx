"use client"

import { useEffect, useMemo, useState } from "react"
import { BuyerService } from "@/services/buyer-service"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Buyer } from "@/lib/supabase"

interface RecipientsPreviewSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  buyerIds: string[]
}

const PAGE_SIZE = 50

function getInitials(buyer: Buyer) {
  const first = buyer.fname?.[0] || buyer.full_name?.[0] || "?"
  const last = buyer.lname?.[0] || buyer.full_name?.split(" ")?.[1]?.[0] || ""
  return `${first}${last}`.toUpperCase()
}

function getStatus(buyer: Buyer) {
  if (buyer.sendfox_suppressed) return "suppressed"
  if (buyer.sendfox_bounced_at) return "bounced"
  if (buyer.sendfox_complained_at) return "complained"
  if (buyer.status && buyer.status !== "active") return buyer.status
  return ""
}

export default function RecipientsPreviewSheet({ open, onOpenChange, buyerIds }: RecipientsPreviewSheetProps) {
  const [loadedRows, setLoadedRows] = useState<Buyer[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const buyerIdsKey = buyerIds.join(",")

  useEffect(() => {
    if (!open) return
    setLoadedRows([])
    setPage(1)
    setQuery("")
  }, [open, buyerIdsKey])

  useEffect(() => {
    if (!open) return
    const idsToLoad = buyerIds.slice(0, page * PAGE_SIZE)
    let active = true
    setLoading(true)
    BuyerService.getBuyersByIds(idsToLoad)
      .then((rows) => {
        if (!active) return
        setLoadedRows(rows)
      })
      .catch(() => {
        if (!active) return
        setLoadedRows([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, page, buyerIds])

  const filteredRows = useMemo(() => {
    if (!query.trim()) return loadedRows
    const q = query.trim().toLowerCase()
    return loadedRows.filter((buyer) => {
      const fullName = `${buyer.fname || ""} ${buyer.lname || ""}`.trim().toLowerCase()
      const fallback = (buyer.full_name || "").toLowerCase()
      const email = (buyer.email || "").toLowerCase()
      return fullName.includes(q) || fallback.includes(q) || email.includes(q)
    })
  }, [loadedRows, query])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full flex flex-col">
        <SheetHeader>
          <SheetTitle>Recipients preview</SheetTitle>
          <SheetDescription>Read-only preview of prefilled recipients.</SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <Input placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="mt-4 flex-1 overflow-y-auto space-y-2">
          {!loading && filteredRows.length === 0 && (
            <div className="text-sm text-muted-foreground">No matching buyers.</div>
          )}
          {filteredRows.map((buyer) => {
            const status = getStatus(buyer)
            const name = buyer.full_name || `${buyer.fname || ""} ${buyer.lname || ""}`.trim() || "Unnamed"
            return (
              <div key={buyer.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {getInitials(buyer)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">{buyer.email || "No email"}</p>
                  </div>
                </div>
                {status ? <Badge variant="secondary" className="text-xs">{status}</Badge> : null}
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
          <span>
            Showing 1-{Math.min(loadedRows.length, buyerIds.length)} of {buyerIds.length}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={loading || loadedRows.length >= buyerIds.length}
          >
            Load more
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
