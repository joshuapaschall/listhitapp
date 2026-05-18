"use client"

import { useEffect, useMemo, useState } from "react"
import { BatteryMedium, Signal } from "lucide-react"
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
    return () => {
      mounted = false
    }
  }, [buyerIds])

  const activeBuyer = sampleBuyers[previewIndex] || FALLBACK_BUYERS[0]
  const rendered = useMemo(() => renderTemplate(message || "", activeBuyer), [message, activeBuyer])
  const initials = `${activeBuyer?.fname?.[0] || "L"}${activeBuyer?.lname?.[0] || "H"}`

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">Preview as</div>
      <Select value={String(previewIndex)} onValueChange={(v) => setPreviewIndex(Number(v))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {sampleBuyers.map((buyer, idx) => (
            <SelectItem key={buyer.id || idx} value={String(idx)}>{buyer.fname} {buyer.lname}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>9:41</span><div className="flex items-center gap-1"><Signal className="h-3 w-3" /><BatteryMedium className="h-3 w-3" /></div></div>
        <div className="mb-3 text-center">
          <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-xs font-medium text-brand">{initials}</div>
          <p className="text-xs text-muted-foreground">+1 (770) 555-0123</p>
        </div>
        <div className="max-w-[85%] rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-md bg-card p-3 text-sm">{rendered || "Your message preview appears here"}</div>
        <p className="mt-2 text-xs text-muted-foreground">Delivered</p>
      </div>
    </div>
  )
}
