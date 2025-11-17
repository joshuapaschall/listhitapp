import Bottleneck from "bottleneck"
import { TELNYX_API_URL, getTelnyxApiKey } from "@/lib/voice-env"
import { calculateSmsSegments } from "./sms-utils"

const envOptions: RateLimiterOptions = {}
if (process.env.TELNYX_GLOBAL_MPS)
  envOptions.globalMps = Number(process.env.TELNYX_GLOBAL_MPS)
if (process.env.TELNYX_CARRIER_MPS)
  envOptions.carrierMps = Number(process.env.TELNYX_CARRIER_MPS)
if (process.env.TELNYX_TMO_DAILY_LIMIT)
  envOptions.tmobileSegments = Number(process.env.TELNYX_TMO_DAILY_LIMIT)

function msUntilMidnightEastern(): number {
  const now = new Date()
  const estNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const tomorrow = new Date(estNow.getFullYear(), estNow.getMonth(), estNow.getDate() + 1)
  return tomorrow.getTime() - estNow.getTime()
}

export interface RateLimiterOptions {
  globalMps?: number
  carrierMps?: number
  tmobileSegments?: number
  refreshMs?: number
}

export function createSmsRateLimiter(options: RateLimiterOptions = {}) {
  const {
    globalMps = 12,
    carrierMps = 4,
    tmobileSegments = 10000,
    refreshMs = msUntilMidnightEastern(),
  } = options

  const globalLimiter = new Bottleneck({ minTime: 1000 / globalMps })
  const carrierGroup = new Bottleneck.Group({ minTime: 1000 / carrierMps })
  const tmobileLimiter = new Bottleneck({
    minTime: 1000 / carrierMps,
    reservoir: tmobileSegments,
    reservoirRefreshAmount: tmobileSegments,
    reservoirRefreshInterval: refreshMs,
  })

  const carrierCache: Record<string, string | null> = {}

  async function lookupCarrier(phone: string): Promise<string | null> {
    if (carrierCache[phone] !== undefined) return carrierCache[phone]
    const apiKey = getTelnyxApiKey()
    if (!apiKey) {
      carrierCache[phone] = null
      return null
    }
    try {
      const res = await fetch(`${TELNYX_API_URL}/number_lookup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone_number: phone }),
      })
      if (!res.ok) {
        carrierCache[phone] = null
        return null
      }
      const data = await res.json()
      const name = data?.data?.carrier?.name || null
      carrierCache[phone] = name
      return name
    } catch {
      carrierCache[phone] = null
      return null
    }
  }

  function getLimiter(carrier: string) {
    if (/t-?mobile/i.test(carrier)) return tmobileLimiter
    return carrierGroup.key(carrier.toLowerCase())
  }

  async function scheduleSMS(carrier: string, body: string, fn: () => Promise<any>) {
    const segments = calculateSmsSegments(body).segments
    return globalLimiter.schedule(() => getLimiter(carrier).schedule({ weight: segments }, fn))
  }

  return { scheduleSMS, lookupCarrier, globalLimiter, carrierGroup, tmobileLimiter }
}

const defaultLimiter = createSmsRateLimiter(
  process.env.NODE_ENV === "test"
    ? { globalMps: Infinity, carrierMps: Infinity, tmobileSegments: Number.MAX_SAFE_INTEGER }
    : envOptions,
)
export const scheduleSMS = defaultLimiter.scheduleSMS
export const lookupCarrier = defaultLimiter.lookupCarrier
