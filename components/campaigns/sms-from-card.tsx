"use client"

import { useEffect, useState } from "react"
import { Phone, Users, Wand2 } from "lucide-react"
import { fetchMessagingThroughput } from "@/lib/sms-throughput"

interface SmsFromCardProps {
  buyerIds: string[]
}

export default function SmsFromCard({ buyerIds }: SmsFromCardProps) {
  const [poolSize, setPoolSize] = useState(15)
  const defaultDid = process.env.NEXT_PUBLIC_DEFAULT_OUTBOUND_DID ?? null

  useEffect(() => {
    let mounted = true

    fetchMessagingThroughput()
      .then(({ poolSize }) => {
        if (mounted) setPoolSize(poolSize)
      })
      .catch((err) => {
        console.error("Failed to fetch messaging throughput", err)
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        ListHit doesn&apos;t use a single sender number — your Telnyx messaging profile has a pool of <span className="font-medium text-foreground">{poolSize} numbers</span> that rotate automatically.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-1.5 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10"><Users className="h-3.5 w-3.5 text-brand" /></div><span className="text-xs font-medium">Existing conversation</span></div>
          <p className="text-xs text-muted-foreground">Buyer keeps replying to the same number they last received from — no surprise area-code switches mid-thread.</p>
        </div>

        <div className="rounded-lg border bg-card p-3">
          <div className="mb-1.5 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10"><Wand2 className="h-3.5 w-3.5 text-brand" /></div><span className="text-xs font-medium">First contact</span></div>
          <p className="text-xs text-muted-foreground">Telnyx picks an unused number from the pool, balancing load across all {poolSize} numbers to maximize deliverability.</p>
        </div>

        <div className="rounded-lg border bg-card p-3">
          <div className="mb-1.5 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10"><Phone className="h-3.5 w-3.5 text-brand" /></div><span className="text-xs font-medium">Fallback</span></div>
          <p className="text-xs text-muted-foreground">If the pool is unreachable, the system falls back to <span className="font-mono text-foreground">{defaultDid ?? "the configured default"}</span>.</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Multi-market routing (separate pools per market) is coming soon. {buyerIds.length > 0 ? `(${buyerIds.length.toLocaleString()} recipients selected)` : ""}</p>
    </div>
  )
}
