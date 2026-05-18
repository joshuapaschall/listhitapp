"use client"

interface SmsFromCardProps {
  buyerIds: string[]
}

export default function SmsFromCard({ buyerIds }: SmsFromCardProps) {
  const defaultFromNumber = process.env.NEXT_PUBLIC_DEFAULT_OUTBOUND_DID ?? null

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        ListHit picks the sender phone number per recipient using this priority:
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Most recent thread&apos;s preferred number (message_threads.preferred_from_number)</li>
        <li>Buyer&apos;s sticky sender (buyer_sms_senders.from_number)</li>
        <li>Default outbound DID (DEFAULT_OUTBOUND_DID env) — {defaultFromNumber ?? "not configured"}</li>
      </ol>
      <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
        Per-buyer breakdown loads at send time. ({buyerIds.length} selected)
      </div>
      <p className="text-xs text-muted-foreground">Markets — multi-market sender selection coming soon.</p>
    </div>
  )
}
