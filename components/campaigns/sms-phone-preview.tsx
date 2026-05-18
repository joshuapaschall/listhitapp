"use client"

import { useEffect, useMemo, useState } from "react"
import { BuyerService } from "@/services/buyer-service"
import { renderTemplate } from "@/lib/utils"
import type { Buyer } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SmsPhonePreviewProps {
  message: string
  buyerIds: string[]
}

const FALLBACK_BUYERS: Buyer[] = [
  { id: "sample1", fname: "John", lname: "Doe" } as Buyer,
  { id: "sample2", fname: "Jane", lname: "Smith" } as Buyer,
]

export default function SmsPhonePreview({ message, buyerIds }: SmsPhonePreviewProps) {
  const [sampleBuyers, setSampleBuyers] = useState<Buyer[]>(FALLBACK_BUYERS)
  const [previewIndex, setPreviewIndex] = useState(0)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!buyerIds.length) {
        setSampleBuyers(FALLBACK_BUYERS)
        return
      }
      const buyers = await BuyerService.getBuyersByIds(buyerIds.slice(0, 3))
      if (mounted) {
        setSampleBuyers(buyers?.length ? buyers : FALLBACK_BUYERS)
        setPreviewIndex(0)
      }
    }
    run()
    return () => { mounted = false }
  }, [buyerIds])

  const activeBuyer = sampleBuyers[previewIndex] || FALLBACK_BUYERS[0]
  const rendered = useMemo(() => renderTemplate(message || "", activeBuyer), [message, activeBuyer])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Preview as</span>
        <Select value={String(previewIndex)} onValueChange={(v) => setPreviewIndex(Number(v))}>
          <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {sampleBuyers.map((buyer, idx) => (
              <SelectItem key={buyer.id || idx} value={String(idx)}>{buyer.fname} {buyer.lname}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mx-auto" style={{ maxWidth: 280 }}>
        <div className="relative rounded-[40px] border-[10px] border-foreground/90 bg-background shadow-sm" style={{ aspectRatio: "9/16" }}>
          <div className="absolute left-1/2 top-2 h-1.5 w-20 -translate-x-1/2 rounded-full bg-foreground/90" />
          <div className="absolute inset-2 overflow-hidden rounded-[28px] bg-card">
            <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
              <span className="text-xs font-medium">Messages</span>
              <span className="text-xs text-muted-foreground">Now</span>
            </div>
            <div className="flex flex-col gap-1 px-3 py-3">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-brand px-3 py-2 text-sm text-white" style={{ wordBreak: "break-word" }}>
                  {rendered || "Your message preview appears here"}
                </div>
              </div>
              <span className="self-end text-[10px] text-muted-foreground">Delivered</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
