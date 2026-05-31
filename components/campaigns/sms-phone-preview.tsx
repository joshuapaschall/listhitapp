"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, BatteryFull, Signal, Wifi } from "lucide-react"
import { BuyerService } from "@/services/buyer-service"
import { renderTemplate } from "@/lib/utils"
import type { Buyer } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMyMergeContext } from "@/hooks/use-my-merge-context"

interface SmsPhonePreviewProps {
  message: string
  buyerIds: string[]
  mediaUrls?: string[]
}

const FALLBACK_BUYERS: Buyer[] = [
  { id: "sample1", fname: "John", lname: "Doe" } as Buyer,
  { id: "sample2", fname: "Jane", lname: "Smith" } as Buyer,
]

export default function SmsPhonePreview({ message, buyerIds, mediaUrls = [] }: SmsPhonePreviewProps) {
  const [sampleBuyers, setSampleBuyers] = useState<Buyer[]>(FALLBACK_BUYERS)
  const [previewIndex, setPreviewIndex] = useState(0)
  const myMergeContext = useMyMergeContext()

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
  const rendered = useMemo(
    () => renderTemplate(message || "", activeBuyer, myMergeContext),
    [message, activeBuyer, myMergeContext],
  )

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
        <div className="relative rounded-[44px] border-[10px] border-foreground/90 bg-background shadow-sm" style={{ aspectRatio: "9/16" }}>
          <div className="absolute left-1/2 top-2 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-foreground/90" />
          <div className="absolute inset-2 overflow-hidden rounded-[32px] bg-card">
            <div className="flex items-center justify-between px-4 pt-3 pb-1 text-muted-foreground">
              <span className="text-[12px] font-semibold tracking-tight">9:41</span>
              <div className="flex items-center gap-1.5">
                <Signal className="h-3.5 w-3.5" />
                <Wifi className="h-3.5 w-3.5" />
                <BatteryFull className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="flex items-center justify-center border-b bg-muted/30 px-4 py-2">
              <button type="button" className="absolute left-4 inline-flex items-center text-muted-foreground" aria-label="Back">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold text-muted-foreground">Text message</span>
            </div>
            <div className="relative">
              <div className="max-h-[360px] overflow-y-auto scroll-smooth px-3 py-3">
                <div className="flex flex-col gap-1">
                  {mediaUrls.length > 0 && (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl p-1" style={{ backgroundColor: "#0A84FF" }}>
                        <img src={mediaUrls[0]} alt="Attached media preview" className="rounded-xl object-cover" style={{ maxHeight: 200 }} />
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm text-white whitespace-pre-wrap" style={{ wordBreak: "break-word", backgroundColor: "#0A84FF" }}>
                      {rendered || "Your message preview appears here"}
                    </div>
                  </div>
                  <span className="self-end text-[10px] text-muted-foreground">Delivered</span>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-card" />
            </div>
          </div>
          <div className="absolute bottom-1.5 left-1/2 h-1.5 w-24 -translate-x-1/2 rounded-full bg-foreground/70" />
        </div>
      </div>
    </div>
  )
}
