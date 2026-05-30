export const PER_CAMPAIGN_BOUNCE_RATE = 0.08
export const PER_CAMPAIGN_COMPLAINT_RATE = 0.002
export const MIN_SENT_FOR_EVAL = 50
export const MIN_HARD_BOUNCES = 5
export const MIN_COMPLAINTS = 2

export type CampaignSafetyVerdict = {
  trip: boolean
  reason?: "bounce" | "complaint"
  bounceRate: number
  complaintRate: number
}

export function evaluateCampaignSafety(input: {
  sent: number
  hardBounces: number
  complaints: number
}): CampaignSafetyVerdict {
  const bounceRate = input.sent > 0 ? input.hardBounces / input.sent : 0
  const complaintRate = input.sent > 0 ? input.complaints / input.sent : 0

  const bounceTrip =
    input.sent >= MIN_SENT_FOR_EVAL &&
    input.hardBounces >= MIN_HARD_BOUNCES &&
    bounceRate >= PER_CAMPAIGN_BOUNCE_RATE

  if (bounceTrip) {
    return { trip: true, reason: "bounce", bounceRate, complaintRate }
  }

  const complaintTrip =
    input.complaints >= MIN_COMPLAINTS &&
    complaintRate >= PER_CAMPAIGN_COMPLAINT_RATE

  if (complaintTrip) {
    return { trip: true, reason: "complaint", bounceRate, complaintRate }
  }

  return { trip: false, bounceRate, complaintRate }
}
