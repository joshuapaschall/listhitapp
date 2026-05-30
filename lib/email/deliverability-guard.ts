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

// Phase 2 — account-wide reputation guard.
// These thresholds freeze below AWS SES review thresholds so sending stops before
// the account enters the SES enforcement ladder.
export const ACCOUNT_WARN_BOUNCE_RATE = 0.03
export const ACCOUNT_WARN_COMPLAINT_RATE = 0.0005
export const ACCOUNT_FREEZE_BOUNCE_RATE = 0.04
export const ACCOUNT_FREEZE_COMPLAINT_RATE = 0.0008
export const ACCOUNT_MIN_WINDOW_SENT = 500

export type AccountState = "healthy" | "warn" | "frozen"

export type AccountVerdict = {
  state: AccountState
  reason: string | null
  bounceRate: number
  complaintRate: number
}

export function evaluateAccountState(input: {
  windowSent: number
  hardBounces: number
  complaints: number
  enforcementStatus: string | null
  sendingEnabled: boolean | null
}): AccountVerdict {
  const enforcementStatus = input.enforcementStatus?.trim() || null
  const bounceRate = input.windowSent > 0 ? input.hardBounces / input.windowSent : 0
  const complaintRate = input.windowSent > 0 ? input.complaints / input.windowSent : 0

  if (enforcementStatus && enforcementStatus.toUpperCase() !== "HEALTHY") {
    return {
      state: "frozen",
      reason: `enforcement:${enforcementStatus}`,
      bounceRate,
      complaintRate,
    }
  }

  if (input.sendingEnabled === false) {
    return {
      state: "frozen",
      reason: "sending_disabled",
      bounceRate,
      complaintRate,
    }
  }

  if (input.windowSent < ACCOUNT_MIN_WINDOW_SENT) {
    return { state: "healthy", reason: null, bounceRate, complaintRate }
  }

  if (
    bounceRate >= ACCOUNT_FREEZE_BOUNCE_RATE ||
    complaintRate >= ACCOUNT_FREEZE_COMPLAINT_RATE
  ) {
    return { state: "frozen", reason: "rate", bounceRate, complaintRate }
  }

  if (
    bounceRate >= ACCOUNT_WARN_BOUNCE_RATE ||
    complaintRate >= ACCOUNT_WARN_COMPLAINT_RATE
  ) {
    return { state: "warn", reason: "rate", bounceRate, complaintRate }
  }

  return { state: "healthy", reason: null, bounceRate, complaintRate }
}
