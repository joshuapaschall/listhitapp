// Pool config — read from public env vars so the composer UI can show estimates.
// Defaults match Joshua's current Telnyx setup: 15 numbers in pool, 2 messages/minute/number (long code).

const DEFAULT_POOL_SIZE = 15
const DEFAULT_PER_NUMBER_MPM = 2

export function getPoolSize(): number {
  const raw = Number(process.env.NEXT_PUBLIC_LISTHIT_POOL_SIZE)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_POOL_SIZE
}

export function getPerNumberMpm(): number {
  const raw = Number(process.env.NEXT_PUBLIC_LISTHIT_PER_NUMBER_MPM)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PER_NUMBER_MPM
}

export interface ThroughputEstimate {
  totalMinutes: number
  poolSize: number
  perNumberMpm: number
  label: string
}

export function estimateDeliveryTime(recipients: number, segments: number): ThroughputEstimate {
  const poolSize = getPoolSize()
  const perNumberMpm = getPerNumberMpm()
  const totalMessages = Math.max(0, recipients) * Math.max(1, segments)
  const accountMpm = poolSize * perNumberMpm
  const totalMinutes = accountMpm > 0 ? totalMessages / accountMpm : 0

  let label: string
  if (totalMessages === 0) label = "—"
  else if (totalMinutes < 1) label = "<1 min"
  else if (totalMinutes < 60) label = `~${Math.ceil(totalMinutes)} min`
  else {
    const h = Math.floor(totalMinutes / 60)
    const m = Math.round(totalMinutes % 60)
    label = m === 0 ? `~${h}h` : `~${h}h ${m}m`
  }

  return { totalMinutes, poolSize, perNumberMpm, label }
}
