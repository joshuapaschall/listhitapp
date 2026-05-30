export const SMS_FAILURE_RATE = 0.12
export const SMS_OPTOUT_RATE = 0.03
export const SMS_MIN_SENT_FOR_FAILURE = 50
export const SMS_MIN_FAILURES = 10
export const SMS_MIN_SENT_FOR_OPTOUT = 100
export const SMS_MIN_OPTOUTS = 5

export type SmsSafetyVerdict = {
  trip: boolean
  reason?: "failure" | "optout"
  failureRate: number
  optOutRate: number
}

export function evaluateSmsCampaignSafety(input: {
  sent: number
  failures: number
  optOuts: number
}): SmsSafetyVerdict {
  const failureRate = input.sent > 0 ? input.failures / input.sent : 0
  const optOutRate = input.sent > 0 ? input.optOuts / input.sent : 0

  const failureTrip =
    input.sent >= SMS_MIN_SENT_FOR_FAILURE &&
    input.failures >= SMS_MIN_FAILURES &&
    failureRate >= SMS_FAILURE_RATE

  if (failureTrip) {
    return { trip: true, reason: "failure", failureRate, optOutRate }
  }

  const optOutTrip =
    input.sent >= SMS_MIN_SENT_FOR_OPTOUT &&
    input.optOuts >= SMS_MIN_OPTOUTS &&
    optOutRate >= SMS_OPTOUT_RATE

  if (optOutTrip) {
    return { trip: true, reason: "optout", failureRate, optOutRate }
  }

  return { trip: false, failureRate, optOutRate }
}
