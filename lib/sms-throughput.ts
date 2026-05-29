export interface ThroughputEstimate {
  totalMinutes: number
  poolSize: number
  perNumberMpm: number
  label: string
}

export interface ThroughputEstimateInput {
  recipients: number
  segments: number
  poolSize: number
  perNumberMpm: number
}

export function estimateDeliveryTime({
  recipients,
  segments,
  poolSize,
  perNumberMpm,
}: ThroughputEstimateInput): ThroughputEstimate {
  const safePoolSize = Number.isFinite(poolSize) && poolSize > 0 ? poolSize : 1
  const safePerNumberMpm = Number.isFinite(perNumberMpm) && perNumberMpm > 0 ? perNumberMpm : 1
  const totalMessages = Math.max(0, recipients) * Math.max(1, segments)
  const accountMpm = safePoolSize * safePerNumberMpm
  const totalMinutes = totalMessages / accountMpm

  let label: string
  if (totalMessages === 0) label = "—"
  else if (totalMinutes < 1) label = "<1 min"
  else if (totalMinutes < 60) label = `~${Math.ceil(totalMinutes)} min`
  else {
    const h = Math.floor(totalMinutes / 60)
    const m = Math.round(totalMinutes % 60)
    label = m === 0 ? `~${h}h` : `~${h}h ${m}m`
  }

  return { totalMinutes, poolSize: safePoolSize, perNumberMpm: safePerNumberMpm, label }
}

export async function fetchMessagingThroughput(): Promise<{ poolSize: number; perNumberMpm: number; source: string }> {
  const res = await fetch("/api/messaging/throughput", { cache: "no-store" })
  if (!res.ok) return { poolSize: 1, perNumberMpm: 2, source: "default" }
  return res.json()
}
