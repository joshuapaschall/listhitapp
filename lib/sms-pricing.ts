// Blended Telnyx outbound pricing (US, weighted by carrier market share).
// AT&T 47%, Verizon 30%, T-Mobile 21%, US Cellular 2%.
//
// SMS:  $0.004 per message part + carrier fees ($0.0035 ATT, $0.0045 VZ/TMO, $0.005 USC)
//   blended = 0.47*0.0075 + 0.30*0.0085 + 0.21*0.0085 + 0.02*0.009 ≈ $0.00804/segment
// MMS:  $0.015 per message part + carrier fees ($0.009 ATT, $0.007 VZ, $0.01 TMO/USC)
//   blended ≈ $0.0239/segment

export const BLENDED_SMS_RATE_USD = 0.008
export const BLENDED_MMS_RATE_USD = 0.024

export interface CostEstimateInput {
  recipients: number
  segments: number
  hasMedia: boolean
}

export interface CostEstimate {
  perRecipient: number
  total: number
  rateLabel: string
}

export function estimateCampaignCost({ recipients, segments, hasMedia }: CostEstimateInput): CostEstimate {
  const rate = hasMedia ? BLENDED_MMS_RATE_USD : BLENDED_SMS_RATE_USD
  const perRecipient = rate * Math.max(1, segments)
  const total = perRecipient * Math.max(0, recipients)
  return { perRecipient, total, rateLabel: hasMedia ? "MMS" : "SMS" }
}

export function formatUsd(value: number): string {
  if (value < 1) return `$${value.toFixed(4)}`
  if (value < 100) return `$${value.toFixed(2)}`
  return `$${Math.round(value).toLocaleString()}`
}
