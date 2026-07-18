// Blended Telnyx outbound pricing (US, weighted by carrier market share).
// AT&T 47%, Verizon 30%, T-Mobile 21%, US Cellular 2%.
//
// SMS:  $0.004 per message part + carrier fees ($0.0035 ATT, $0.0045 VZ/TMO, $0.005 USC)
//   blended = 0.47*0.0075 + 0.30*0.0085 + 0.21*0.0085 + 0.02*0.009 ≈ $0.00804/segment
// MMS:  $0.015 per message part + carrier fees ($0.009 ATT, $0.007 VZ, $0.01 TMO/USC)
//   blended ≈ $0.0239/segment

export const BLENDED_SMS_RATE_USD = 0.008
export const BLENDED_MMS_RATE_USD = 0.024

export type SmsBillingProvider = "telnyx" | "twilio"

// Blended US estimates. Telnyx values are the current cited ones.
// TWILIO values are approximate blended US rates — Josh should verify against
// his Twilio negotiated/published pricing and tune these two constants.
const RATES: Record<SmsBillingProvider, { sms: number; mms: number }> = {
  telnyx: { sms: BLENDED_SMS_RATE_USD, mms: BLENDED_MMS_RATE_USD },
  twilio: { sms: 0.0083, mms: 0.02 }, // VERIFY against Twilio pricing
}

export interface CostEstimateInput {
  recipients: number
  segments: number
  hasMedia: boolean
  provider?: SmsBillingProvider
}

export interface CostEstimate {
  perRecipient: number
  total: number
  rateLabel: "SMS" | "MMS"
  estimated: true
}

export function estimateCampaignCost({ recipients, segments, hasMedia, provider = "telnyx" }: CostEstimateInput): CostEstimate {
  const rate = RATES[provider] ?? RATES.telnyx
  // MMS is billed per message; SMS is billed per segment.
  const perRecipient = hasMedia ? rate.mms : rate.sms * Math.max(1, segments)
  const total = perRecipient * Math.max(0, recipients)
  return { perRecipient, total, rateLabel: hasMedia ? "MMS" : "SMS", estimated: true }
}

export function formatUsd(value: number): string {
  if (value < 1) return `$${value.toFixed(4)}`
  if (value < 100) return `$${value.toFixed(2)}`
  return `$${Math.round(value).toLocaleString()}`
}
