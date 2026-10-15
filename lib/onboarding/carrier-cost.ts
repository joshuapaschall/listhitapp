// Rough carrier pass-through cost of a texting registration, shown to platform
// admins before they approve spend. Estimates from Twilio's published US pricing
// (one-time registration + vetting fees, then monthly program + number fees);
// update when Twilio changes them.

export type CarrierCostEstimate = { oneTime: number; monthly: number; label: string }

export function estimateCarrierCost(brandType: string | null | undefined): CarrierCostEstimate {
  const sole = brandType === "SOLE_PROPRIETOR"
  const oneTime = sole ? 4.41 + 15 : 44 + 15
  const monthly = sole ? 2 + 1.15 : 10 + 1.15
  return {
    oneTime,
    monthly,
    label: `~$${oneTime.toFixed(2)} one-time + ~$${monthly.toFixed(2)}/mo`,
  }
}
